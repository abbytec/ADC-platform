export { AuthError } from "@common/types/custom-errors/AuthError.js";
import { createAdcApi, type AdcFetchResult, type RequestOptions } from "@ui-library/utils/adc-fetch";

export interface AuthUser {
	id: string;
	username: string;
	email: string;
	avatar?: string;
	permissions?: string[];
	orgId?: string;
}

export interface OrgOption {
	orgId: string;
	slug: string;
}

export interface AuthResponse {
	success: boolean;
	user?: AuthUser;
	error?: string;
	/** Indica que el usuario debe seleccionar una organización antes de concretar el login */
	requiresOrgSelection?: boolean;
	userId?: string;
	username?: string;
	orgOptions?: OrgOption[];
}

export interface SessionResponse {
	authenticated: boolean;
	user?: AuthUser;
	expiresAt?: number;
	error?: string;
}

/** Error data returned when account is blocked */
export interface BlockedErrorData {
	blockedUntil?: number;
}

/**
 * Auth API client using createAdcApi
 * - same-origin credentials (cookies sent only to same domain)
 * - Automatic error handling via adc-custom-error
 */
const api = createAdcApi({
	basePath: "/api/auth",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

export const authApi = {
	/**
	 * Login nativo con username/password
	 * Si el usuario tiene orgs, puede retornar requiresOrgSelection con las opciones.
	 * En ese caso, llamar de nuevo con orgId para completar el login.
	 * @param options - Request options (e.g., translateParams for blocked time formatting)
	 */
	login: (
		username: string,
		password: string,
		options?: Pick<RequestOptions<BlockedErrorData>, "translateParams">,
		orgId?: string | null
	): Promise<AdcFetchResult<AuthResponse>> =>
		api.post<AuthResponse, BlockedErrorData>("/login", {
			body: { username, password, ...(orgId !== undefined ? { orgId } : {}) },
			...options,
		}),

	/**
	 * Registro de nuevo usuario
	 */
	register: (username: string, email: string, password: string): Promise<AdcFetchResult<AuthResponse>> =>
		api.post<AuthResponse>("/register", { body: { username, email, password } }),

	/**
	 * Obtener sesión actual
	 */
	getSession: (): Promise<AdcFetchResult<SessionResponse>> => api.get<SessionResponse>("/session"),

	/**
	 * Cerrar sesión
	 */
	logout: (): Promise<AdcFetchResult<{ success: boolean }>> => api.post<{ success: boolean }>("/logout"),

	/**
	 * Refrescar tokens
	 */
	refresh: (): Promise<AdcFetchResult<{ success: boolean }>> => api.post<{ success: boolean }>("/refresh"),

	/**
	 * Cambiar contexto de organización (re-emite tokens)
	 * @param orgId - ID de la organización o undefined para acceso personal
	 */
	switchOrg: (orgId?: string): Promise<AdcFetchResult<AuthResponse>> => api.post<AuthResponse>("/switch-org", { body: { orgId } }),

	/**
	 * Obtener organizaciones del usuario autenticado
	 */
	getUserOrgs: (): Promise<AdcFetchResult<{ orgs: OrgOption[]; currentOrgId?: string }>> =>
		api.get<{ orgs: OrgOption[]; currentOrgId?: string }>("/user-orgs"),
};
