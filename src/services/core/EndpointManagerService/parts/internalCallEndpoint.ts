import SessionManagerService from "../../../security/SessionManagerService/index.ts";
import { ServiceCallRequest, ServiceCallResponse } from "../types.ts";
import { createPermissionValidator } from "./validator.ts";

/**
 * Llama a un método de otro servicio con validación de permisos
 *
 * @param request - Configuración de la llamada
 * @returns Resultado de la llamada
 */
export async function internalCallEndpoint<T>(
	request: ServiceCallRequest,
	getSessionManager: () => SessionManagerService | null,
	getMyService: (serviceName: string) => any
): Promise<ServiceCallResponse<T>> {
	const { serviceName, methodName, args, requiredPermissions, callerToken } = request;

	// Validar permisos si se requieren
	if (requiredPermissions && requiredPermissions.length > 0) {
		const validator = createPermissionValidator(getSessionManager);
		const authResult = await validator(callerToken || null, requiredPermissions);
		if (!authResult.valid) {
			return {
				success: false,
				error: authResult.error || "Permisos insuficientes",
			};
		}
	}

	try {
		// Obtener el servicio desde el registry
		const service = getMyService(serviceName);
		if (!service) {
			return {
				success: false,
				error: `Servicio ${serviceName} no encontrado`,
			};
		}

		// Verificar que el método existe
		if (typeof service[methodName] !== "function") {
			return {
				success: false,
				error: `Método ${methodName} no existe en ${serviceName}`,
			};
		}

		// Ejecutar el método
		const result = await service[methodName](...args);

		return {
			success: true,
			result: result as T,
		};
	} catch (error: any) {
		return {
			success: false,
			error: error.message || "Error ejecutando servicio",
		};
	}
}
