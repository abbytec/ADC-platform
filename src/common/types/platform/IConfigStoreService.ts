/**
 * Configuración administrada: configmaps y secretos que viven en la base y en la bóveda en vez de
 * en un `env/*.env` de cada máquina.
 *
 * La LECTURA por nombre no pasa por acá: es `managedConfig()` de `@common/utils/managed-config.ts`,
 * síncrona porque la consume la interpolación de los `config.json`. Esta interfaz es el camino de
 * administración, para que un panel no tenga que meterle mano a la colección de otro servicio.
 */

import type { CapabilityToken } from "@common/security/Capability.ts";

/** Alcance de una entrada: `global`, `site:<sitio>` o `node:<id>`. Gana el más específico. */
export type ConfigScopeName = string;

export interface ConfigMapEntry {
	name: string;
	scope: ConfigScopeName;
	value: string;
	updatedAt: string | null;
	updatedBy: string | null;
}

/**
 * Un secreto **sin su valor**. Es lo único que sale por API salvo un `revealSecret()` explícito.
 * `digest` permite comparar dos despliegues sin revelar nada.
 */
export interface SecretEntry {
	name: string;
	scope: ConfigScopeName;
	/** `sha256(valor)` truncado. Sirve para ver si dos nodos tienen lo mismo, no para recuperarlo. */
	digest: string;
	version: number;
	updatedAt: string | null;
	updatedBy: string | null;
	/** `true` si el valor está en la bóveda pero no abre con la master key actual. */
	unreadable: boolean;
}

/** Cómo se resolvió cada almacén al arrancar: lo que el panel necesita para no mentir sobre el estado. */
export interface ConfigStoreHealth {
	/** De dónde salió lo que está cargado. `backup` = la base o la bóveda no respondieron. */
	source: "store" | "backup" | "none";
	configmaps: number;
	secrets: number;
	/** Secretos que están en el índice y no se pudieron abrir. Un clúster sano lo tiene vacío. */
	unreadable: string[];
	/** Nombres administrados que además siguen definidos en el entorno: gana el store y hay que avisarlo. */
	shadowedEnv: string[];
	loadedAt: string | null;
}

/**
 * Las mutaciones exigen la capability del llamador (`this.getCapability()`), no un booleano:
 * `config:write` para escribir y `config:reveal` para leer un secreto en claro. Sin eso, cualquier
 * módulo que declarara este servicio en su `config.json` se llevaba la bóveda entera.
 *
 * Los dos listados quedan sin gate: `listConfigMaps` devuelve valores que ya están en `process.env`
 * de todos los módulos, y `listSecrets` no devuelve ninguno. Quién puede *verlos en el panel* lo
 * decide el permiso del usuario en la capa HTTP, que es donde se sabe quién preguntó.
 */
export interface IConfigStoreService {
	listConfigMaps(): Promise<ConfigMapEntry[]>;
	setConfigMap(token: CapabilityToken, scope: ConfigScopeName, name: string, value: string, actor: string | undefined): Promise<void>;
	deleteConfigMap(token: CapabilityToken, scope: ConfigScopeName, name: string, actor?: string): Promise<void>;

	/** Sin valores: para el panel. Revelar uno es una operación aparte y auditada. */
	listSecrets(): Promise<SecretEntry[]>;
	setSecret(token: CapabilityToken, scope: ConfigScopeName, name: string, value: string, actor: string | undefined): Promise<void>;
	deleteSecret(token: CapabilityToken, scope: ConfigScopeName, name: string, actor?: string): Promise<void>;
	/**
	 * Devuelve el valor en claro de UN secreto. Exige `config:reveal` y deja constancia **estricta**
	 * antes de leer: sin auditoría no hay revelado. Quien la llame tiene que haber comprobado además
	 * el permiso del usuario y la sesión de bóveda.
	 */
	revealSecret(token: CapabilityToken, scope: ConfigScopeName, name: string, actor?: string): Promise<string | null>;

	health(): ConfigStoreHealth;
}
