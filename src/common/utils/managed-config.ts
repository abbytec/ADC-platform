/**
 * Registro único de la configuración **administrada**: la que vive en la base y en la bóveda en vez
 * de en un `env/*.env` de cada máquina.
 *
 * Son tres almacenes con semántica distinta y un solo punto de lectura:
 *
 * - **values**: perillas que declara el código, con lista blanca y default (`PlatformSettingsService`).
 * - **configmaps**: configuración que declara el despliegue (hosts, puertos, límites de un motor).
 * - **secrets**: igual que un configmap, pero el valor nunca se devuelve por API ni se escribe en un log.
 *
 * **Un nombre vive en un solo almacén.** Si aparece en dos, {@link installManagedConfig} lo rechaza:
 * inventar una precedencia entre almacenes sería inventar una regla que nadie recuerda a los seis
 * meses, y el síntoma —un valor que "no toma"— aparece lejos de la causa.
 *
 * **No lee nada**: recibe el mapa ya resuelto y lo entrega de forma síncrona, porque quien lo
 * consulta es `ModuleLoader.interpolateEnvVars` y volverlo asíncrono obligaría a reescribir la carga
 * de módulos entera. Lo instala `ConfigStoreService` en su `start()`.
 */

/** Qué almacén respondió. `undefined` = el nombre no está administrado. */
export type ManagedOrigin = "value" | "configmap" | "secret";

interface Snapshot {
	values: ReadonlyMap<string, string>;
	configmaps: ReadonlyMap<string, string>;
	secrets: ReadonlyMap<string, string>;
}

const EMPTY: Snapshot = { values: new Map(), configmaps: new Map(), secrets: new Map() };

let snapshot: Snapshot = EMPTY;

class ManagedConfigCollisionError extends Error {
	constructor(public readonly collisions: ReadonlyArray<{ name: string; stores: string[] }>) {
		super(
			`Hay ${collisions.length} nombre(s) definido(s) en más de un almacén de configuración: ` +
				collisions.map((c) => `${c.name} (${c.stores.join(" y ")})`).join(", ") +
				". Un nombre vive en un solo almacén; borralo de todos menos uno."
		);
		this.name = "ManagedConfigCollisionError";
	}
}

function collisionsOf(input: { values: Record<string, string>; configmaps: Record<string, string>; secrets: Record<string, string> }) {
	const seen = new Map<string, string[]>();
	for (const [store, values] of Object.entries(input)) {
		for (const name of Object.keys(values)) {
			const stores = seen.get(name);
			if (stores) stores.push(store);
			else seen.set(name, [store]);
		}
	}
	return [...seen].filter(([, stores]) => stores.length > 1).map(([name, stores]) => ({ name, stores }));
}

/**
 * Instala el mapa resuelto. Lo llama **sólo** `ConfigStoreService`, y una vez por arranque: un
 * segundo reemplazo a mitad de la carga dejaría dos módulos configurados con valores distintos sin
 * que nada lo indique.
 *
 * @throws {ManagedConfigCollisionError} si un nombre está en más de un almacén.
 */
export function installManagedConfig(input: {
	values?: Record<string, string>;
	configmaps?: Record<string, string>;
	secrets?: Record<string, string>;
}): void {
	const next = { values: input.values ?? {}, configmaps: input.configmaps ?? {}, secrets: input.secrets ?? {} };
	const collisions = collisionsOf(next);
	if (collisions.length > 0) throw new ManagedConfigCollisionError(collisions);
	snapshot = {
		values: new Map(Object.entries(next.values)),
		configmaps: new Map(Object.entries(next.configmaps)),
		secrets: new Map(Object.entries(next.secrets)),
	};
}

/**
 * Instala **sólo** el almacén de values, conservando los otros dos.
 *
 * Existe porque `PlatformSettingsService` (`kernelMode 5`) corre después de `ConfigStoreService`
 * (`kernelMode 4`) y es el dueño de esa mitad. Colisionar contra lo ya instalado se rechaza igual.
 */
export function installManagedValues(values: Record<string, string>): void {
	const collisions = collisionsOf({
		values,
		configmaps: Object.fromEntries(snapshot.configmaps),
		secrets: Object.fromEntries(snapshot.secrets),
	});
	if (collisions.length > 0) throw new ManagedConfigCollisionError(collisions);
	snapshot = { ...snapshot, values: new Map(Object.entries(values)) };
}

/** `undefined` si el nombre no está administrado o si todavía no se leyó ningún almacén. */
export function managedConfig(name: string): string | undefined {
	return snapshot.values.get(name) ?? snapshot.configmaps.get(name) ?? snapshot.secrets.get(name);
}

/** Nombres administrados por almacén. **No** devuelve valores de secretos. */
export function managedNames(): { values: string[]; configmaps: string[]; secrets: string[] } {
	return {
		values: [...snapshot.values.keys()],
		configmaps: [...snapshot.configmaps.keys()],
		secrets: [...snapshot.secrets.keys()],
	};
}

/**
 * Refleja en memoria un valor que se acaba de guardar, para que el resto del proceso no relea la
 * base. La llaman **sólo** los servicios dueños de cada almacén.
 *
 * No contradice el «una vez por arranque» de {@link installManagedConfig}, que prohíbe reemplazar el
 * mapa entero: cambiar una clave desde el panel es una decisión explícita. Aplicarla en caliente
 * queda de parte de cada consumidor.
 */
export function updateManagedEntry(store: ManagedOrigin, name: string, value: string): void {
	const cm_sec = store === "configmap" ? "configmaps" : "secrets";
	const key = store === "value" ? "values" : cm_sec;
	const next = new Map(snapshot[key]);
	next.set(name, value);
	snapshot = { ...snapshot, [key]: next };
}

/** Quita una clave del almacén que la tenga. */
export function removeManagedEntry(store: ManagedOrigin, name: string): void {
	const cm_sec = store === "configmap" ? "configmaps" : "secrets";
	const key = store === "value" ? "values" : cm_sec;
	const next = new Map(snapshot[key]);
	next.delete(name);
	snapshot = { ...snapshot, [key]: next };
}
