/**
 * Interfaz para verificación de autenticación y autorización
 * Inyectada en los managers para verificar tokens y permisos
 */
export interface IAuthVerifier {
	/**
	 * Verifica un token y retorna el userId si es válido
	 */
	verifyToken(token: string): Promise<{ valid: boolean; userId?: string; orgId?: string; error?: string }>;

	/**
	 * Verifica si un usuario tiene un permiso específico
	 */
	hasPermission(userId: string, action: number, scope: number, orgId?: string): Promise<boolean>;
}

/**
 * Función que retorna un AuthVerifier (permite lazy loading)
 */
export type AuthVerifierGetter = () => IAuthVerifier | null;

/**
 * Error de autorización
 */
export class AuthorizationError extends Error {
	constructor(
		message: string,
		public readonly code: "NO_TOKEN" | "INVALID_TOKEN" | "INSUFFICIENT_PERMISSIONS" = "INSUFFICIENT_PERMISSIONS"
	) {
		super(message);
		this.name = "AuthorizationError";
	}
}

/**
 * Clase base para verificación de permisos en managers
 * Usa una función getter para resolver dependencias circulares
 */
export class PermissionChecker {
	constructor(
		private readonly getAuthVerifier: AuthVerifierGetter,
		private readonly managerName: string
	) {}

	/**
	 * Verifica que el usuario del token tiene permisos para la operación
	 * @throws AuthorizationError si no tiene permisos o si el token no está presente
	 * @returns userId del usuario autenticado, o "" si no hay auth system configurado
	 */
	async requirePermission(token: string | undefined, action: number, scope: number, orgId?: string): Promise<string> {
		const authVerifier = this.getAuthVerifier();

		// Auth system no configurado (durante init o servicios internos sin auth)
		if (!authVerifier) {
			return "";
		}

		// Auth system configurado pero sin token → error
		if (!token) {
			throw new AuthorizationError(`[${this.managerName}] Token de autenticación requerido`, "NO_TOKEN");
		}

		const result = await authVerifier.verifyToken(token);
		if (!result.valid || !result.userId) {
			throw new AuthorizationError(result.error || "Token inválido", "INVALID_TOKEN");
		}

		const effectiveOrgId = orgId ?? result.orgId;
		const hasPermission = await authVerifier.hasPermission(result.userId, action, scope, effectiveOrgId);
		if (!hasPermission) {
			throw new AuthorizationError(
				`Usuario ${result.userId} no tiene permisos (action=${action}, scope=${scope})`,
				"INSUFFICIENT_PERMISSIONS"
			);
		}

		return result.userId;
	}
}
