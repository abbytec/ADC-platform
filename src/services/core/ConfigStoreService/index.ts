import type MongoProvider from "@providers/object/mongo/index.js";
import type InternalS3Provider from "@providers/object/internal-s3-provider/index.js";
import { BaseService } from "@services/BaseService.js";
import { Kernel } from "@kernel";
import { HttpError } from "@common/types/ADCCustomError.ts";
import { FatalBootError } from "@common/types/custom-errors/FatalBootError.ts";
import { assertScope, Scope, type CapabilityToken } from "@common/security/Capability.ts";
import { sha256Hex } from "@common/utils/crypto.ts";
import { nodeId, nodeSite } from "@common/utils/cluster-env.ts";
import { registerSecretValues } from "@common/utils/redact.ts";
import { installManagedConfig, managedNames, removeManagedEntry, updateManagedEntry } from "@common/utils/managed-config.ts";
import { ConfigSecretSealer, GLOBAL_SCOPE, scopeChain, type ConfigScope } from "@common/utils/config-store/sealer.ts";
import { readBackup, writeBackup } from "@common/utils/config-store/backup.ts";
import type { ConfigMapEntry, ConfigStoreHealth, IConfigStoreService, SecretEntry } from "@common/types/platform/IConfigStoreService.ts";
import type { IAuditLogService } from "@common/types/security/AuditLog.ts";
import { docId, getConfigMapModel, getSecretIndexModel, type ConfigMapDoc, type SecretIndexDoc } from "./dao/entries.ts";
import { SecretVault } from "./vault.ts";

/** Largo del digest que se publica. 16 hex alcanzan para comparar dos nodos y no para nada más. */
const DIGEST_LENGTH = 16;

/**
 * Configuración administrada del clúster: **configmaps** (en Mongo) y **secretos** (sellados, en el
 * almacén de objetos), con respaldo local cifrado para arrancar sin ninguno de los dos.
 *
 * `kernelMode 4` — antes que `PlatformSettingsService` (5) y que todo lo demás, porque estos valores
 * se interpolan dentro de los `config.json` de cada módulo al cargarlos. Por el mismo motivo **no
 * declara `EndpointManagerService`**: arrastraría el servidor HTTP a cargarse antes que esto. La
 * administración por HTTP la expone otro servicio, más tarde en el arranque.
 *
 * Lo que **no** puede vivir acá es lo que hace falta para leer esto mismo: la master key, las
 * credenciales de Mongo y las del almacén de objetos. Ésas se quedan en `env/`, y son la frontera.
 *
 * Con la base o la bóveda caídas degrada al respaldo local (`failOnError: false`): sin él, cada
 * valor cae al entorno o al default de su `config.json`, con un warning ruidoso.
 */
export default class ConfigStoreService extends BaseService implements IConfigStoreService {
	public readonly name = "ConfigStoreService";

	#mongo!: MongoProvider;
	#s3: InternalS3Provider | null = null;
	#vault: SecretVault | null = null;
	#sealer: ConfigSecretSealer | null = null;
	#configMaps: ReturnType<typeof getConfigMapModel> | null = null;
	#secretIndex: ReturnType<typeof getSecretIndexModel> | null = null;
	#health: ConfigStoreHealth = { source: "none", configmaps: 0, secrets: 0, unreadable: [], shadowedEnv: [], loadedAt: null };
	/** Alcances de este nodo, de lo general a lo particular. Gana el último. */
	#scopes: ConfigScope[] = [];

	constructor(kernel: Kernel, options?: any) {
		super(kernel, options);
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);
		this.#scopes = scopeChain(nodeSite(), nodeId());
		this.#sealer = new ConfigSecretSealer(this.logger);

		const bucket = String(this.config?.bucket ?? "adc-config");
		this.#mongo = this.getMyProvider<MongoProvider>("object/mongo");
		// La espera **no** puede propagarse: con la base caída, dejar morir este servicio significa
		// arrancar sin ninguna configuración administrada, sin siquiera intentar el respaldo local —
		// que es exactamente el escenario para el que el respaldo existe.
		const mongoReady = await this.waitForProvider(this.#mongo, "MongoDB").then(
			() => true,
			(error: Error) => {
				this.logger.logWarn(`[config-store] la base no respondió (${error.message}): se intenta el respaldo local.`);
				return false;
			}
		);
		this.#s3 = this.tryGetMyProvider<InternalS3Provider>("object/internal-s3-provider") ?? null;
		if (this.#s3) this.#vault = new SecretVault(this.#s3, bucket);

		const loaded = mongoReady && (await this.#loadFromStore());
		if (!loaded) this.#loadFromBackup();
		else this.#fillSecretsFromBackup();
		this.#install();
	}

	// ── Carga ────────────────────────────────────────────────────────────────────

	/** `false` si la base o la bóveda no respondieron: ahí manda el respaldo local. */
	async #loadFromStore(): Promise<boolean> {
		let maps: ConfigMapDoc[];
		let index: SecretIndexDoc[];
		try {
			this.#configMaps = getConfigMapModel(this.#mongo.getConnection());
			this.#secretIndex = getSecretIndexModel(this.#mongo.getConnection());
			maps = await this.#configMaps.find({ scope: { $in: this.#scopes } }).lean<ConfigMapDoc[]>();
			index = await this.#secretIndex.find({ scope: { $in: this.#scopes } }).lean<SecretIndexDoc[]>();
		} catch (error) {
			this.logger.logWarn(`[config-store] no se pudo leer la configuración administrada (${(error as Error).message}).`);
			return false;
		}

		const configmaps = this.#mergeByScope(maps.map((d) => ({ scope: d.scope, name: d.name, value: d.value })));
		const { secrets, sealed, sealedScopes, unreadable } = await this.#openSecrets(index);

		// `complete` es lo que decide si se puede reescribir el respaldo. Una lectura a la que le
		// faltan secretos NO es una foto del estado bueno: guardarla borraría del respaldo justo lo
		// que hace falta la próxima vez que la bóveda no esté.
		this.#pending = { configmaps, secrets, sealed, sealedScopes, unreadable, source: "store", complete: unreadable.length === 0 };
		return true;
	}

	/**
	 * Rellena con el respaldo local los secretos que la bóveda no entregó.
	 *
	 * Es el caso «Mongo sí, almacén de objetos no»: el índice dice qué secretos existen y el respaldo
	 * tiene sus sobres de la última lectura buena. Sin esto, un Garage caído dejaba al nodo sin
	 * ninguna credencial administrada aunque el respaldo estuviera intacto al lado.
	 *
	 * Lo que no abre acá tampoco iba a abrir en la bóveda —el sobre es el mismo y la clave también—,
	 * así que un fallo acá confirma que el problema es la master key y no la red.
	 */
	#fillSecretsFromBackup(): void {
		const pending = this.#pending;
		if (!pending || pending.unreadable.length === 0) return;
		const backup = readBackup();
		if (!backup) return;

		const recovered: string[] = [];
		for (const name of [...pending.unreadable]) {
			const sealedValue = backup.sealed[name];
			if (!sealedValue) continue;
			const scope = backup.sealedScopes[name] ?? GLOBAL_SCOPE;
			const plain = this.#sealer!.open(scope, name, sealedValue, this.logger);
			if (plain === null) continue;
			pending.secrets[name] = plain;
			pending.sealed[name] = sealedValue;
			pending.sealedScopes[name] = scope;
			pending.unreadable.splice(pending.unreadable.indexOf(name), 1);
			recovered.push(name);
		}
		if (recovered.length > 0) {
			this.logger.logWarn(
				`[config-store] la bóveda no entregó ${recovered.length} secreto(s) y se tomaron del respaldo local: ${recovered.join(", ")}. ` +
					"El respaldo NO se reescribe hasta que la bóveda vuelva a responder entera."
			);
		}
	}

	/**
	 * Abre cada secreto del índice. Se leen en paralelo porque son N objetos independientes y en
	 * serie el arranque pagaría N viajes de red uno detrás de otro.
	 */
	async #openSecrets(index: SecretIndexDoc[]) {
		const secrets: Record<string, string> = {};
		const sealed: Record<string, string> = {};
		const sealedScopes: Record<string, string> = {};
		const unreadable: string[] = [];
		if (!this.#vault || index.length === 0) {
			if (index.length > 0) unreadable.push(...index.map((d) => d.name));
			return { secrets, sealed, sealedScopes, unreadable };
		}

		// Se abre POR ALCANCE y no después de mezclar: la AAD ata cada valor al alcance bajo el que se
		// guardó, así que mezclando primero se pierde de cuál vino y los del alcance general no abrirían.
		const opened = await Promise.all(
			index.map(async (doc) => {
				const raw = await this.#vault!.get(doc.scope, doc.name);
				return { doc, plain: this.#sealer!.open(doc.scope, doc.name, raw, this.logger), raw };
			})
		);
		const byScope: Array<{ scope: string; name: string; value: string }> = [];
		for (const { doc, plain, raw } of opened) {
			if (plain === null) {
				unreadable.push(doc.name);
				continue;
			}
			byScope.push({ scope: doc.scope, name: doc.name, value: plain });
			if (raw) {
				sealed[doc.name] = raw;
				sealedScopes[doc.name] = doc.scope;
			}
		}
		Object.assign(secrets, this.#mergeByScope(byScope));
		return { secrets, sealed, sealedScopes, unreadable };
	}

	/** Aplasta las entradas de varios alcances respetando el orden de {@link scopeChain}. */
	#mergeByScope(entries: Array<{ scope: string; name: string; value: string }>): Record<string, string> {
		const out: Record<string, string> = {};
		for (const scope of this.#scopes) {
			for (const entry of entries) if (entry.scope === scope) out[entry.name] = entry.value;
		}
		return out;
	}

	#pending: {
		configmaps: Record<string, string>;
		secrets: Record<string, string>;
		sealed: Record<string, string>;
		sealedScopes: Record<string, string>;
		unreadable: string[];
		source: "store" | "backup";
		/** `false` si a esta carga le faltó algo: entonces el respaldo local **no** se toca. */
		complete: boolean;
	} | null = null;

	#loadFromBackup(): void {
		const backup = readBackup();
		if (!backup) {
			this.logger.logWarn(
				"[config-store] sin base, sin bóveda y sin respaldo local: cada módulo va a usar su default o lo que haya en el entorno."
			);
			return;
		}
		const secrets: Record<string, string> = {};
		const unreadable: string[] = [];
		for (const [name, sealedValue] of Object.entries(backup.sealed)) {
			const scope = backup.sealedScopes[name] ?? "global";
			const plain = this.#sealer!.open(scope, name, sealedValue, this.logger);
			if (plain === null) unreadable.push(name);
			else secrets[name] = plain;
		}
		this.#pending = {
			configmaps: backup.plain,
			secrets,
			sealed: backup.sealed,
			sealedScopes: backup.sealedScopes,
			unreadable,
			source: "backup",
			complete: false,
		};
		this.logger.logWarn(
			`[config-store] la base o la bóveda no respondieron: se arranca con el respaldo local del ${backup.writtenAt} ` +
				`(${Object.keys(backup.plain).length} valores, ${Object.keys(backup.sealed).length} secretos).`
		);
	}

	/**
	 * Instala el mapa, lo inyecta en `process.env` y deja el respaldo al día.
	 *
	 * A `process.env` van con `??=`: lo exportado en el shell sigue ganando, y con eso los composes de
	 * Docker y `scripts/infra.ts` reciben la configuración administrada sin cambiarles una línea.
	 */
	#install(): void {
		const pending = this.#pending;
		if (!pending) return;

		// Antes de instalar nada: qué nombres administrados siguen puestos en el entorno con OTRO valor.
		// Que una variable de entorno quede ignorada tiene que verse — es la confusión más cara de esta
		// arquitectura: alguien edita el archivo, reinicia y no cambia nada.
		const all = { ...pending.configmaps, ...pending.secrets };
		const shadowedEnv = Object.keys(all).filter((name) => {
			const fromEnv = process.env[name];
			return fromEnv !== undefined && fromEnv !== "" && fromEnv !== all[name];
		});

		try {
			installManagedConfig({ configmaps: pending.configmaps, secrets: pending.secrets });
		} catch (error) {
			// Un nombre en dos almacenes no se puede resolver adivinando: los módulos quedarían
			// configurados con el valor de uno o de otro según el orden, y el síntoma aparecería
			// lejos. Es de las pocas cosas que tienen que detener el arranque.
			throw new FatalBootError(
				`La configuración administrada es incoherente: ${(error as Error).message}`,
				"Borrá el nombre duplicado de todos los almacenes menos uno (colecciones `config_maps` y `config_secrets`, y `defaults.json`). " +
					"Para entrar a la máquina mientras tanto: `ADC_ALLOW_DEGRADED_BOOT=true`.",
				{ cause: error }
			);
		}
		for (const [name, value] of Object.entries(all)) process.env[name] ??= value;
		registerSecretValues(Object.values(pending.secrets));

		this.#health = {
			source: pending.source,
			configmaps: Object.keys(pending.configmaps).length,
			secrets: Object.keys(pending.secrets).length,
			unreadable: pending.unreadable,
			shadowedEnv,
			loadedAt: new Date().toISOString(),
		};

		if (pending.source === "store") this.#saveBackup();
		this.logger.logOk(
			`[config-store] ${this.#health.configmaps} configmap(s) y ${this.#health.secrets} secreto(s) desde ${pending.source === "store" ? "la base" : "el respaldo local"}.`
		);
		if (pending.unreadable.length > 0) {
			this.logger.logWarn(
				`[config-store] ${pending.unreadable.length} secreto(s) en el índice que NO abren: ${pending.unreadable.join(", ")}. ` +
					"Suele ser que cambió ADC_STORAGE_MASTER_KEY; hay que volver a cargarlos desde el panel."
			);
		}
		if (shadowedEnv.length > 0) {
			this.logger.logWarn(
				`[config-store] estas variables siguen definidas en el entorno pero manda el store: ${shadowedEnv.join(", ")}. ` +
					"Cambiarlas en `env/` no tiene efecto."
			);
		}
	}

	/**
	 * El respaldo se reescribe entero: es una foto del estado bueno, no un diario de cambios.
	 *
	 * Por eso **sólo una carga completa puede escribirlo**, y la guarda vive acá y no en cada
	 * llamador: con la bóveda a medias, guardar lo que se pudo leer borraría del respaldo justo los
	 * secretos que hacen falta la próxima vez que no responda — que es la única razón por la que el
	 * respaldo existe.
	 */
	#saveBackup(): void {
		const pending = this.#pending;
		if (!pending || !pending.complete) return;
		try {
			writeBackup({
				writtenAt: new Date().toISOString(),
				writtenBy: nodeId(),
				plain: pending.configmaps,
				sealed: pending.sealed,
				sealedScopes: pending.sealedScopes,
			});
		} catch (error) {
			// No es fatal: el nodo ya está cargado. Lo que se pierde es poder arrancar sin red la próxima.
			this.logger.logWarn(`[config-store] no se pudo escribir el respaldo local (${(error as Error).message}).`);
		}
	}

	// ── Administración ───────────────────────────────────────────────────────────

	async listConfigMaps(): Promise<ConfigMapEntry[]> {
		if (!this.#configMaps) return [];
		const docs = await this.#configMaps.find({}).sort({ _id: 1 }).lean<ConfigMapDoc[]>();
		return docs.map((d) => ({
			name: d.name,
			scope: d.scope,
			value: d.value,
			updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
			updatedBy: d.updatedBy ?? null,
		}));
	}

	async setConfigMap(token: CapabilityToken, scope: ConfigScope, name: string, value: string, actor: string | undefined): Promise<void> {
		assertScope(token, Scope.ConfigWrite);
		this.#assertName(name);
		this.#assertNotInOtherStore(name, "configmap");
		const model = this.#requireModel(this.#configMaps);
		await model.updateOne(
			{ _id: docId(scope, name) },
			{ $set: { scope, name, value, updatedAt: new Date(), updatedBy: actor ?? "desconocido" } },
			{ upsert: true }
		);
		if (this.#scopes.includes(scope)) {
			updateManagedEntry("configmap", name, value);
			process.env[name] = value;
			if (this.#pending) this.#pending.configmaps[name] = value;
			this.#saveBackup();
		}
		this.logger.logWarn(`[config-store] configmap '${name}' (${scope}) cambiado por '${actor ?? "desconocido"}'.`);
		await this.#audit("config.configmap-set", actor, `configmap:${scope}/${name}`, { scope, name });
	}

	async deleteConfigMap(token: CapabilityToken, scope: ConfigScope, name: string, actor?: string): Promise<void> {
		assertScope(token, Scope.ConfigWrite);
		const model = this.#requireModel(this.#configMaps);
		await model.deleteOne({ _id: docId(scope, name) });
		if (this.#scopes.includes(scope)) {
			removeManagedEntry("configmap", name);
			if (this.#pending) delete this.#pending.configmaps[name];
			this.#saveBackup();
		}
		await this.#audit("config.configmap-delete", actor, `configmap:${scope}/${name}`, { scope, name });
	}

	async listSecrets(): Promise<SecretEntry[]> {
		if (!this.#secretIndex) return [];
		const docs = await this.#secretIndex.find({}).sort({ _id: 1 }).lean<SecretIndexDoc[]>();
		const unreadable = new Set(this.#health.unreadable);
		return docs.map((d) => ({
			name: d.name,
			scope: d.scope,
			digest: d.digest,
			version: d.version,
			updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
			updatedBy: d.updatedBy ?? null,
			unreadable: unreadable.has(d.name),
		}));
	}

	/**
	 * Guarda un secreto: **primero la bóveda, después el índice**.
	 *
	 * Ese orden importa. Si falla la bóveda no se toca el índice y el estado anterior sigue completo;
	 * al revés, el índice anunciaría un valor que no existe y el próximo arranque lo reportaría como
	 * ilegible. Un sobre huérfano en la bóveda no rompe nada: nadie lo busca sin índice.
	 */
	async setSecret(token: CapabilityToken, scope: ConfigScope, name: string, value: string, actor: string | undefined): Promise<void> {
		assertScope(token, Scope.ConfigWrite);
		this.#assertName(name);
		this.#assertNotInOtherStore(name, "secret");
		if (!this.#vault || !this.#sealer) {
			throw new HttpError(503, "VAULT_UNAVAILABLE", "La bóveda no está disponible: falta el almacén de objetos.");
		}
		const model = this.#requireModel(this.#secretIndex);
		const sealed = this.#sealer.seal(scope, name, value);
		await this.#vault.put(scope, name, sealed);

		const previous = await model.findOne({ _id: docId(scope, name) }).lean<SecretIndexDoc>();
		await model.updateOne(
			{ _id: docId(scope, name) },
			{
				$set: {
					scope,
					name,
					digest: sha256Hex(value).slice(0, DIGEST_LENGTH),
					version: (previous?.version ?? 0) + 1,
					updatedAt: new Date(),
					updatedBy: actor ?? "desconocido",
				},
			},
			{ upsert: true }
		);

		if (this.#scopes.includes(scope)) {
			updateManagedEntry("secret", name, value);
			process.env[name] = value;
			if (this.#pending) {
				this.#pending.secrets[name] = value;
				this.#pending.sealed[name] = sealed;
				this.#pending.sealedScopes[name] = scope;
			}
			registerSecretValues(Object.values(this.#pending?.secrets ?? {}));
			this.#saveBackup();
		}
		// El valor NO se loguea, y el nombre sí: sin el nombre la auditoría no sirve para nada.
		this.logger.logWarn(`[config-store] secreto '${name}' (${scope}) cambiado por '${actor ?? "desconocido"}'.`);
		await this.#audit("config.secret-set", actor, `secret:${scope}/${name}`, { scope, name, version: (previous?.version ?? 0) + 1 });
	}

	/** Borra índice y sobre. El índice primero: un sobre huérfano es inofensivo, un índice sin sobre no. */
	async deleteSecret(token: CapabilityToken, scope: ConfigScope, name: string, actor?: string): Promise<void> {
		assertScope(token, Scope.ConfigWrite);
		const model = this.#requireModel(this.#secretIndex);
		await model.deleteOne({ _id: docId(scope, name) });
		await this.#vault?.remove(scope, name);
		if (this.#scopes.includes(scope)) {
			removeManagedEntry("secret", name);
			if (this.#pending) {
				delete this.#pending.secrets[name];
				delete this.#pending.sealed[name];
				delete this.#pending.sealedScopes[name];
			}
			registerSecretValues(Object.values(this.#pending?.secrets ?? {}));
			this.#saveBackup();
		}
		await this.#audit("config.secret-delete", actor, `secret:${scope}/${name}`, { scope, name });
	}

	/**
	 * El valor en claro de UN secreto, leído de la bóveda y no de la copia en memoria: revelar tiene
	 * que decir lo que está guardado, no lo que este proceso cargó al arrancar.
	 *
	 * Exige `config:reveal`, el scope más caro del árbol. Lo que **no** comprueba es el permiso del
	 * usuario ni la sesión de bóveda: eso es de quien la llama, que es el único que sabe quién pidió
	 * el valor. Mezclarlo acá obligaría a que este servicio, que corre antes que la sesión y la
	 * auditoría, dependiera de las dos.
	 */
	async revealSecret(token: CapabilityToken, scope: ConfigScope, name: string, actor?: string): Promise<string | null> {
		assertScope(token, Scope.ConfigReveal);
		// La constancia se escribe ANTES de leer y es estricta: si no se puede dejar rastro de quién
		// pidió una credencial, no se entrega. Auditar después dejaría sin registro justo el caso que
		// importa —el que falla a la mitad—, y acá el orden es lo único que lo garantiza.
		await this.#audit("config.secret-reveal", actor, `secret:${scope}/${name}`, { scope, name }, true);
		if (!this.#vault || !this.#sealer) return null;
		return this.#sealer.open(scope, name, await this.#vault.get(scope, name), this.logger);
	}

	health(): ConfigStoreHealth {
		return this.#health;
	}

	// ── Auditoría ────────────────────────────────────────────────────────────────

	/**
	 * Deja rastro de un cambio o de una lectura de la configuración.
	 *
	 * `AuditLogService` es `kernelMode 55` y esto es `kernelMode 4`, así que se resuelve **al llamar**
	 * y no al arrancar: declararlo en `config.json` no lo carga (los servicios declarados sólo se
	 * resuelven del registro), y para cuando alguien toca el panel ya está arriba.
	 *
	 * `strict` lo usa el revelado: si no se puede dejar constancia de quién leyó una credencial, no se
	 * lee. Para los cambios alcanza con best-effort — el valor nuevo ya está guardado y perder la
	 * entrada de auditoría no puede deshacerlo.
	 */
	async #audit(action: string, actor: string | undefined, target: string, context: Record<string, string | number | boolean>, strict = false): Promise<void> {
		const audit = this.tryGetMyService<IAuditLogService>("AuditLogService");
		if (!audit) {
			if (strict) {
				throw new HttpError(503, "AUDIT_UNAVAILABLE", "No se puede revelar un secreto sin dejar constancia: el registro de auditoría no está disponible.");
			}
			return;
		}
		// El valor NUNCA entra en el contexto: el audit log se lee desde un panel y se exporta.
		const entry = { action, actorUserId: actor ?? "desconocido", targetResource: target, context };
		if (strict) await audit.recordStrict(this.getCapability(), entry);
		else await audit.record(this.getCapability(), entry).catch(() => undefined);
	}

	// ── Guardas ──────────────────────────────────────────────────────────────────

	/**
	 * Los nombres se interpolan dentro de los `config.json` de **todos** los módulos, así que aceptar
	 * cualquier string sería inyectar configuración arbitraria en cualquiera de ellos.
	 */
	#assertName(name: string): void {
		if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(name)) {
			throw new HttpError(400, "INVALID_CONFIG_NAME", `'${name}' no es un nombre válido: mayúsculas, dígitos y guion bajo, hasta 64.`);
		}
	}

	/** El mismo nombre en dos almacenes es el error que {@link installManagedConfig} rechaza al arrancar. */
	#assertNotInOtherStore(name: string, target: "configmap" | "secret"): void {
		const names = managedNames();
		const other = target === "configmap" ? names.secrets : names.configmaps;
		if (other.includes(name)) {
			throw new HttpError(409, "CONFIG_NAME_TAKEN", `'${name}' ya existe como ${target === "configmap" ? "secreto" : "configmap"}.`);
		}
		if (names.values.includes(name)) {
			throw new HttpError(409, "CONFIG_NAME_TAKEN", `'${name}' ya es una opción de plataforma declarada en defaults.json.`);
		}
	}

	#requireModel<T>(model: T | null): NonNullable<T> {
		if (!model) throw new HttpError(503, "CONFIG_STORE_UNAVAILABLE", "La configuración administrada no está disponible: no se pudo leer la base.");
		return model as NonNullable<T>;
	}
}
