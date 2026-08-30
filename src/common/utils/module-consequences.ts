/**
 * Qué deja de cumplirse al detener un módulo, cuando eso **no se nota mirando la pantalla**.
 *
 * Hermano de `criticalComposeReason` en `infra-composes.ts`, y por el mismo motivo: hay bajas cuyo
 * costo no es «esta app deja de estar» sino «un control deja de aplicarse». La cascada de
 * dependientes que ya calcula el panel no las cubre, porque nadie *depende* de ellos en el grafo de
 * carga — sus consumidores los resuelven de forma opcional y siguen sin ellos.
 *
 * Sólo datos y funciones puras: lo importa el panel (React), donde no hay `process.env` ni acceso al
 * kernel.
 */

/** Clave `<tipo>:<nombre>`, la misma que usa el panel para identificar un módulo. */
const CONSEQUENCES: ReadonlyMap<string, string> = new Map([
	[
		"service:ModerationService",
		"es quien aplica los bans. Detenerlo hace que los inicios de sesión se rechacen con un 503, " +
			"porque entrar sin comprobar bans sería peor que no entrar. Para un despliegue que a propósito no " +
			"tiene moderación, la salida es `AUTH_REQUIRE_BAN_ENFORCEMENT=false`, no dejar el servicio caído.",
	],
	[
		"service:AuditLogService",
		"es el registro de acciones sobre datos personales. Detenerlo hace fallar lo que exige constancia " +
			"(revelar un secreto, por ejemplo) y deja pasar sin registrar todo lo demás: el rastro queda con un " +
			"hueco que después no se puede reconstruir.",
	],
]);

/**
 * Qué se deja de cumplir al detener este módulo, o `null` si su baja se nota por sí sola.
 *
 * La frase completa la arma quien la muestra, para poder anteponer el nombre del módulo.
 */
export function disableConsequence(type: string, name: string): string | null {
	// El nombre de una instancia trae sufijo (`app:config`); la consecuencia es del módulo base.
	return CONSEQUENCES.get(`${type}:${name.split(":")[0]}`) ?? null;
}
