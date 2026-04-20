import { AuthorizationError } from "./custom-errors/AuthorizationError.ts";

/**
 * Interfaz para verificación de autenticación y autorización.
 * Implementada por cada servicio que necesita auth (delegando a IdentityManagerService).
 */
export interface IAuthVerifier {
	verifyToken(token: string): Promise<{ valid: boolean; userId?: string; orgId?: string; error?: string }>;
	hasPermission(userId: string, action: number, scope: number, orgId?: string, resource?: string): Promise<boolean>;
}

export type AuthVerifierGetter = () => IAuthVerifier | null;

/**
 * Verificador de permisos reutilizable.
 * Cada DAO recibe un AuthVerifierGetter y un nombre de recurso.
 */
export class PermissionChecker {
	constructor(
		private readonly getAuthVerifier: AuthVerifierGetter,
		private readonly managerName: string,
		private readonly resource?: string
	) {}

	/**
	 * Verifica que el usuario del token tiene permisos para la operación.
	 * @returns userId del usuario autenticado, o "" si no hay auth system configurado
	 */
	async requirePermission(token: string | undefined, action: number, scope: number, orgId?: string): Promise<string> {
		const authVerifier = this.getAuthVerifier();
		if (!authVerifier) return "";
		if (!token) {
			throw new AuthorizationError(`[${this.managerName}] Token de autenticación requerido`, "NO_TOKEN");
		}
		const result = await authVerifier.verifyToken(token);
		if (!result.valid || !result.userId) {
			throw new AuthorizationError(result.error || "Token inválido", "INVALID_TOKEN");
		}
		const effectiveOrgId = orgId ?? result.orgId;
		const hasPermission = await authVerifier.hasPermission(result.userId, action, scope, effectiveOrgId, this.resource);
		if (!hasPermission) {
			throw new AuthorizationError(
				`Usuario ${result.userId} no tiene permisos (action=${action}, scope=${scope})`,
				"INSUFFICIENT_PERMISSIONS"
			);
		}
		return result.userId;
	}

	/**
	 * Resuelve el userId del token sin requerir un permiso específico.
	 * Útil cuando la autorización se chequea por otra vía (membresía de proyecto, etc.).
	 */
	async resolveUserId(token: string | undefined): Promise<string> {
		const authVerifier = this.getAuthVerifier();
		if (!authVerifier) return "";
		if (!token) {
			throw new AuthorizationError(`[${this.managerName}] Token requerido`, "NO_TOKEN");
		}
		const result = await authVerifier.verifyToken(token);
		if (!result.valid || !result.userId) {
			throw new AuthorizationError(result.error || "Token inválido", "INVALID_TOKEN");
		}
		return result.userId;
	}
}
