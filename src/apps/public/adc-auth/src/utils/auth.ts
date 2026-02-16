export { AuthError } from "@common/types/custom-errors/AuthError.js";
import { createAdcApi, type AdcFetchResult, type RequestOptions } from "@ui-library/utils/adc-fetch";

export interface AuthUser {
	id: string;
	username: string;
	email: string;
	avatar?: string;
	permissions?: string[];
}

export interface AuthResponse {
	success: boolean;
	user?: AuthUser;
	error?: string;
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
	 * @param options - Request options (e.g., translateParams for blocked time formatting)
	 */
	login: (
		username: string,
		password: string,
		options?: Pick<RequestOptions<BlockedErrorData>, "translateParams">
	): Promise<AdcFetchResult<AuthResponse>> =>
		api.post<AuthResponse, BlockedErrorData>("/login", {
			body: { username, password },
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
};
