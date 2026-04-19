import type { LinkedAccount } from "./User.js";

/**
 * Representación del usuario autenticado en sesiones frontend.
 * Fuente única de verdad para session.ts, auth.ts y adc-access-button.
 */
export interface SessionUser {
	id: string;
	username: string;
	email?: string;
	avatar?: string;
	permissions?: string[];
	orgId?: string;
	orgSlug?: string;
	linkedAccounts?: LinkedAccount[];
}

/**
 * Respuesta del endpoint GET /api/auth/session.
 */
export interface SessionResponse {
	authenticated: boolean;
	user?: SessionUser;
	expiresAt?: number;
	error?: string;
}
