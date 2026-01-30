import { type ADCAuthErrorJSON, AuthError } from "@common/types/custom-errors/AuthError.js";

// Re-export AuthError for use in components
export { AuthError };

const IS_DEV = process.env.NODE_ENV === "development";
const API_BASE = `${IS_DEV ? "http://localhost:3000" : ""}/api/auth`;

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

/**
 * Parsea la respuesta de error del backend y lanza un AuthError
 */
async function throwAuthError(response: Response): Promise<never> {
	const errorData: ADCAuthErrorJSON = await response.json();
	throw new AuthError(
		errorData.status || response.status,
		errorData.errorKey || "UNKNOWN_ERROR",
		errorData.message || "Error desconocido",
		errorData.data as AuthError["data"]
	);
}

class AuthAPI {
	/**
	 * Login nativo con username/password
	 */
	async login(username: string, password: string): Promise<AuthResponse> {
		const response = await fetch(`${API_BASE}/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ username, password }),
		});

		if (!response.ok) {
			await throwAuthError(response);
		}

		return response.json();
	}

	/**
	 * Registro de nuevo usuario
	 */
	async register(username: string, email: string, password: string): Promise<AuthResponse> {
		const response = await fetch(`${API_BASE}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ username, email, password }),
		});

		if (!response.ok) {
			await throwAuthError(response);
		}

		return response.json();
	}

	/**
	 * Obtener sesión actual
	 */
	async getSession(): Promise<SessionResponse> {
		const response = await fetch(`${API_BASE}/session`, {
			method: "GET",
			credentials: "include",
		});

		return response.json();
	}

	/**
	 * Cerrar sesión
	 */
	async logout(): Promise<{ success: boolean }> {
		const response = await fetch(`${API_BASE}/logout`, {
			method: "POST",
			credentials: "include",
		});

		return response.json();
	}

	/**
	 * Refrescar tokens
	 */
	async refresh(): Promise<{ success: boolean }> {
		const response = await fetch(`${API_BASE}/refresh`, {
			method: "POST",
			credentials: "include",
		});

		if (!response.ok) {
			throw new Error("No se pudo refrescar la sesión");
		}

		return response.json();
	}
}

export const authApi = new AuthAPI();
