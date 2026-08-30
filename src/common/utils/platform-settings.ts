/**
 * Configuración de plataforma que vive en la base y no en `env/`, porque es del CLÚSTER y no de la
 * máquina: cambiar la retención de un log no puede exigir editar un archivo en cada nodo y
 * reiniciarlos, con el riesgo de que uno quede distinto sin que nada avise.
 *
 * **No puede vivir acá** nada que se lea antes de que exista la base —credenciales de Mongo, Redis
 * y el broker, identidad del nodo, qué motores levanta, la clave maestra— ni los `ADC_PUBLIC_*`,
 * que se hornean en los bundles del navegador antes de que el kernel arranque.
 *
 * Desde que existen los configmaps y la bóveda, esto es la fachada del almacén **values** de
 * `@common/utils/managed-config.ts`: mismos nombres de siempre para no tocar a sus consumidores, y
 * un solo registro abajo que es el que detecta un nombre definido en dos almacenes.
 */

import { installManagedValues, managedConfig, updateManagedEntry } from "./managed-config.ts";

/**
 * Instala el mapa resuelto. Lo llama **sólo** `PlatformSettingsService`, y una vez por arranque: un
 * segundo reemplazo a mitad de la carga dejaría dos módulos configurados con valores distintos sin
 * que nada lo indique.
 */
export function installPlatformSettings(values: Record<string, string>): void {
	installManagedValues(values);
}

/**
 * `undefined` si el nombre no es una opción de plataforma o si todavía no se leyó la base.
 *
 * Resuelve contra los tres almacenes: para quien interpola un `config.json` es indistinto de cuál
 * salga el valor, y era esta función la que ya consultaba.
 */
export function platformSetting(name: string): string | undefined {
	return managedConfig(name);
}

/**
 * Refleja en memoria una opción que se acaba de guardar, para que el resto del proceso no relea la
 * base. La llama **sólo** `PlatformSettingsService`.
 *
 * Cambiar una clave desde el panel es una decisión explícita, a diferencia de reemplazar el mapa
 * entero. Aplicarlo en caliente queda de parte de cada consumidor, como hace el caudal de subida.
 */
export function updatePlatformSetting(name: string, value: string): void {
	updateManagedEntry("value", name, value);
}
