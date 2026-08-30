/**
 * Un fallo que **tiene que detener el arranque**, lo lance quien lo lance.
 *
 * El cargador de servicios kernel atrapa las excepciones de cada servicio y sigue: un servicio roto
 * no puede llevarse el nodo entero, y eso está bien para la mayoría. Pero hay fallos que no son «este
 * servicio no anda» sino «este proceso no puede servir de forma segura»: la clave con la que se
 * abren los secretos, o una configuración compartida que resolvió a algo distinto de lo que dice el
 * clúster. Ahí seguir es peor que no arrancar, porque el nodo queda **sirviendo con otra
 * configuración** y nada avisa río abajo.
 *
 * Es más fino que `failOnError` del `config.json`, que es por módulo y no por fallo: un servicio
 * puede degradar cuando su base no responde y ser fatal cuando su configuración es incoherente.
 * `failOnError` sigue existiendo y también corta; esto permite cortar sin declararse fatal entero.
 *
 * **No la uses para «esto es importante».** El criterio es: ¿seguir deja al proceso sirviendo algo
 * que un operador razonable llamaría incorrecto y no notaría? Si la respuesta es no, degradá.
 */
export class FatalBootError extends Error {
	/** Qué hacer, en el vocabulario de quien está mirando el arranque fallar. */
	public readonly remedy: string;

	constructor(message: string, remedy: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "FatalBootError";
		this.remedy = remedy;
	}

	/** `true` sin depender de `instanceof`, que falla con dos copias del módulo en memoria. */
	static is(error: unknown): error is FatalBootError {
		return error instanceof Error && error.name === "FatalBootError";
	}
}
