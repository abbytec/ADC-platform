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

export interface AuthError {
	message: string;
	errorKey?: string;
	blockedUntil?: number;
	permanent?: boolean;
	data?: Record<string, unknown>;
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

		const data = await response.json();

		if (!response.ok) {
			const error: AuthError = {
				message: data.message || data.error || "Error de autenticación",
				errorKey: data.errorKey,
				blockedUntil: data.data?.blockedUntil,
				permanent: data.data?.permanent,
				data: data.data,
			};
			throw error;
		}

		return data;
	}

	/**
	 * Registro de nuevo usuario
	 * Nota: Esto requiere un endpoint adicional en SessionManagerService
	 */
	async register(username: string, email: string, password: string): Promise<AuthResponse> {
		// Por ahora, llamamos al endpoint de login tras el registro
		// En una implementación completa, habría un endpoint /api/auth/register
		const response = await fetch(`${API_BASE}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ username, email, password }),
		});

		const data = await response.json();

		if (!response.ok) {
			const error: AuthError = {
				message: data.message || data.error || "Error al crear la cuenta",
				errorKey: data.errorKey,
				data: data.data,
			};
			throw error;
		}

		return data;
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
