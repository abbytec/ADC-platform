export default {
	errors: {
		// Errores HTTP genéricos
		http: {
			400: "Solicitud incorrecta",
			401: "Autenticación requerida",
			403: "Acceso denegado",
			404: "Recurso no encontrado",
			409: "Conflicto con el estado actual",
			500: "Error interno del servidor",
			503: "Servicio no disponible"
		},
		// Errores globales (no específicos de dominio)
		FORBIDDEN: "Acceso denegado",
		UNAUTHORIZED: "No autorizado",
		UNHANDLED_ERROR: "Ha ocurrido un error inesperado",
		UNKNOWN_ERROR: "Error desconocido",
		CONNECTION_REFUSED: "No se pudo conectar con el servidor. Verifica tu conexión o inténtalo más tarde.",
		// Errores genéricos de sesión/auth (authGenericErrors)
		NO_SESSION: "No hay sesión activa",
		INVALID_SESSION: "Sesión inválida",
		NO_REFRESH_TOKEN: "No hay token de refresco",
		INVALID_REFRESH_TOKEN: "Token de refresco inválido",
		LOCATION_CHANGE: "Sesión invalidada por cambio de ubicación",
		REFRESH_FAILED: "Error al refrescar tokens"
	}
};
