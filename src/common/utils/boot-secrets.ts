/**
 * Credenciales de desarrollo que **no pueden llegar a producción**.
 *
 * Los providers y los `docker-compose.yml` traen un default para que un clon recién bajado arranque
 * sin configurar nada. El problema es que ese default también aplica cuando alguien se olvidó de
 * cargar `env/secrets.env` en una máquina real: el nodo levanta, todo *parece* andar, y sirve con un
 * usuario y una contraseña que están publicados en este repositorio.
 *
 * Antes eso ya era grave. Con la bóveda de configuración lo es más: los secretos del clúster viven
 * en un bucket al que se entra con `S3_ACCESS_KEY`, así que una clave de desarrollo deja la bóveda
 * **escribible** por cualquiera que lea el repo. El sobre sigue necesitando la master key para
 * abrirse, pero poder escribir en la bóveda alcanza para reemplazar credenciales ajenas.
 *
 * Por eso el chequeo corta el arranque y no avisa: un warning más en un log de mil líneas es
 * exactamente el modo en que esto llega a producción.
 */

import { isRealProduction } from "./runtime-env.ts";
import { resolveAtRestMasterKey } from "./crypto.ts";

/**
 * Los valores publicados. Se comparan contra el entorno ya resuelto, así que cubren tanto el
 * default del provider como el del `${VAR:-default}` de un `config.json`.
 */
const DEV_VALUES: ReadonlyArray<{ name: string; value: string; what: string }> = [
	{ name: "MONGO_USER", value: "admin", what: "el usuario de la base" },
	{ name: "MONGO_PASSWORD", value: "password", what: "la contraseña de la base" },
	{ name: "S3_ACCESS_KEY", value: "GKadc000000000000000000000", what: "la clave del almacén de objetos, donde vive la bóveda" },
	{
		name: "S3_SECRET_KEY",
		value: "adc0000000000000000000000000000000000000000000000000000000000000",
		what: "el secreto del almacén de objetos, donde vive la bóveda",
	},
	{ name: "RABBITMQ_USER", value: "guest", what: "el usuario del bus entre nodos" },
	{ name: "RABBITMQ_PASSWORD", value: "guest", what: "la contraseña del bus entre nodos" },
	// El pepper no protege un motor: protege los hashes con los que se reconoce a un baneado. Con el
	// de desarrollo —que está en el repositorio— cualquiera puede comprobar si un email dado está
	// baneado, y peor: el día que se cambie, TODOS los bans existentes dejan de matchear en silencio.
	{ name: "BAN_HASH_PEPPER", value: "adc-dev-insecure-pepper-change-me", what: "el pepper de los hashes anti-evasión" },
];

/** Mínimo que `identityHash.getPepper()` exige para no caer al de desarrollo. */
const MIN_PEPPER_LENGTH = 16;

/**
 * Variables cuyo valor **vacío** significa «sin autenticación». En desarrollo es cómodo; en
 * producción es un motor abierto a quien alcance el puerto.
 */
const MUST_NOT_BE_EMPTY: ReadonlyArray<{ name: string; what: string }> = [
	{ name: "REDIS_PASSWORD", what: "Redis guarda las sesiones y los leases de líder" },
	{ name: "GARAGE_RPC_SECRET", what: "sin él, cualquiera que alcance el puerto RPC entra al almacenamiento" },
];

/** Qué encontró, en el vocabulario del operador. Vacío = nada que reportar. */
function findDevCredentials(): string[] {
	const found: string[] = [];
	for (const { name, value, what } of DEV_VALUES) {
		// Sin definir cuenta como "el default": es exactamente el caso del `env/` olvidado.
		const current = process.env[name] ?? value;
		if (current === value) found.push(`${name} sigue siendo el valor de desarrollo (${what})`);
	}
	for (const { name, what } of MUST_NOT_BE_EMPTY) {
		if (!process.env[name]?.trim()) found.push(`${name} está vacío (${what})`);
	}
	// Un pepper corto no falla: `getPepper()` lo descarta y usa el de desarrollo igual, así que
	// comprobar sólo que esté definido dejaría pasar exactamente el caso que se quiere evitar.
	const pepper = process.env.BAN_HASH_PEPPER;
	if (pepper && pepper.length < MIN_PEPPER_LENGTH) {
		found.push(`BAN_HASH_PEPPER tiene menos de ${MIN_PEPPER_LENGTH} caracteres, así que se descarta y se usa el de desarrollo`);
	}
	return found;
}

/**
 * Corta el arranque en producción real si los secretos con los que este nodo tiene que servir no
 * sirven: la master key ilegible, o una credencial en su valor de desarrollo.
 *
 * Se llama desde `kernel.start()` junto a `assertNodeStateReadable()`, y no desde cada provider ni
 * desde el servicio que las usa, por dos motivos: acá el corte **aborta el proceso** (dentro de un
 * servicio kernel lo atraparía el cargador), y un solo lugar es un solo lugar donde mirar qué se
 * considera inseguro.
 */
export function assertBootSecrets(): void {
	if (!isRealProduction()) return;
	assertMasterKeyUsable();
	const found = findDevCredentials();
	if (found.length === 0) return;
	throw new Error(
		`Hay ${found.length} credencial(es) de desarrollo en un arranque de producción:\n` +
			found.map((f) => `  · ${f}`).join("\n") +
			"\n\nEstos valores están publicados en el repositorio. Arrancar así no es una configuración incompleta: " +
			"es servir con credenciales que cualquiera conoce, y con la bóveda de configuración detrás de la clave " +
			"del almacén de objetos, entrega también los secretos del clúster.\n" +
			"Cargá `env/secrets.env` (o las variables equivalentes) y volvé a arrancar. " +
			"Para ejercitar los caminos de producción en una máquina de desarrollo está `bun run start:prodtests`."
	);
}

/**
 * Que la master key exista y sea legible, **acá y no donde se usa**.
 *
 * `resolveAtRestMasterKey()` ya declara que en producción su ausencia es un error de arranque y no
 * una degradación, pero quien la resuelve primero es un servicio kernel — y el cargador de servicios
 * se traga sus excepciones. El resultado era que la política escrita no se cumplía: el nodo
 * arrancaba con los secretos ilegibles, las sesiones sin sellar y una línea roja en el log.
 *
 * Comprobarla al arrancar no cuesta nada (es leer una variable y validar 32 bytes) y convierte esa
 * política en algo que efectivamente pasa.
 */
function assertMasterKeyUsable(): void {
	try {
		resolveAtRestMasterKey();
	} catch (error) {
		throw new Error(
			`La master key de cifrado en reposo no se puede usar: ${(error as Error).message}\n` +
				"Sin ella no se abren los secretos del clúster ni las sesiones selladas, así que este nodo no puede servir. " +
				"Generá una con `openssl rand -hex 32` y mantenela ESTABLE entre reinicios y réplicas.",
			{ cause: error }
		);
	}
}
