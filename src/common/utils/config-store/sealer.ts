import { decryptAtRest, deriveAtRestKey, encryptAtRest, resolveAtRestMasterKey } from "../crypto.ts";

/** Etiqueta de derivación propia: comprometer el material de otro uso no entrega el de la bóveda. */
const KEY_LABEL = "adc-config-secret";

/**
 * Alcance de un valor administrado. Se resuelve de lo general a lo particular y **gana el último**:
 * `global` → `site:<sitio>` → `node:<id>`.
 */
export type ConfigScope = string;

export const GLOBAL_SCOPE = "global";

function siteScope(site: string): ConfigScope {
	return `site:${site}`;
}

function nodeScope(nodeId: string): ConfigScope {
	return `node:${nodeId}`;
}

/**
 * Orden de resolución para un nodo concreto. Devolverlo en una función y no armarlo en cada
 * consumidor es lo que evita que uno de ellos invierta la precedencia sin que nada falle.
 */
export function scopeChain(site: string, nodeId: string): ConfigScope[] {
	return [GLOBAL_SCOPE, siteScope(site), nodeScope(nodeId)];
}

/**
 * Contexto autenticado de un secreto: lo ata a su alcance y a su nombre.
 *
 * Sin esto, un valor sellado sirve en cualquier otro lugar de la bóveda: quien pueda escribir en el
 * almacén de objetos copia el `MONGO_PASSWORD` sellado del alcance global al de un nodo —o lo pega
 * bajo otro nombre— y se entrega como válido, porque la clave es la misma y GCM sólo garantiza que
 * esos bytes no se tocaron, nunca que estén donde corresponde.
 *
 * Es el mismo criterio que ya usa la configuración de alta de nodo (`node-config:<id>:<var>`).
 */
function secretAad(scope: ConfigScope, name: string): string {
	return `secret:${scope}:${name}`;
}

/** La clave del objeto en la bóveda. Un objeto por secreto: escribir uno nunca reescribe otro. */
export function secretKey(scope: ConfigScope, name: string): string {
	return `secrets/${scope}/${name}`;
}

export interface SealerLogger {
	logWarn(msg: string): void;
}

/**
 * Sellador de la bóveda de configuración: cifra y abre valores de ESTE uso, y de ningún otro.
 *
 * La sub-clave es determinística a propósito: quien escribe y quien lee suelen ser procesos
 * distintos (varios nodos), y una clave efímera por proceso dejaría ilegible lo guardado en cada
 * reinicio.
 */
export class ConfigSecretSealer {
	readonly #key: Buffer;

	constructor(logger?: SealerLogger) {
		this.#key = deriveAtRestKey(resolveAtRestMasterKey(logger), KEY_LABEL);
	}

	seal(scope: ConfigScope, name: string, plaintext: string): string {
		return encryptAtRest(plaintext, this.#key, { aad: secretAad(scope, name) });
	}

	/**
	 * Abre un valor, o `null` si no descifra (manipulado, movido de alcance, renombrado, o la master
	 * key cambió). **Nunca** devuelve el crudo como fallback: aceptar un valor que no abre sería una
	 * vía de degradación permanente y justo el ataque que el sobre cierra.
	 */
	open(scope: ConfigScope, name: string, sealed: string | null | undefined, logger?: SealerLogger): string | null {
		if (!sealed) return null;
		try {
			return decryptAtRest(sealed, this.#key, { aad: secretAad(scope, name) });
		} catch (error) {
			logger?.logWarn(`[config-store] '${name}' (${scope}) no abre: ${error}. ¿Cambió ADC_STORAGE_MASTER_KEY o lo escribió otro?`);
			return null;
		}
	}
}
