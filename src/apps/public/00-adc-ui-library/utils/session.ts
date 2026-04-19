/**
 * Sesión compartida — helper para microfrontends que necesitan leer
 * el usuario autenticado y sus permisos sin depender del app adc-auth.
 *
 * Cachea la respuesta de /api/auth/session por 30s para evitar llamadas
 * repetidas. Llamar a `clearSessionCache()` después de login/logout.
 */

import { createAdcApi } from "./adc-fetch.js";
import { hasAnyPermission, type CRUDXActionValue } from "./permissions";
import type { SessionUser, SessionResponse } from "@common/types/identity/Session.js";

/** @deprecated Usa SessionResponse directamente. */
export type SessionData = SessionResponse;

export type { SessionUser, SessionResponse };

const api = createAdcApi({
	basePath: "/api/auth",
	devPort: 3000,
	credentials: "include",
});

const CACHE_TTL_MS = 30_000;
let cache: { data: SessionResponse; ts: number } | null = null;
let inflight: Promise<SessionResponse> | null = null;

export async function getSession(force = false): Promise<SessionResponse> {
	const now = Date.now();
	if (!force && cache && now - cache.ts < CACHE_TTL_MS) return cache.data;
	if (inflight) return inflight;

	inflight = (async () => {
		const result = await api.get<SessionResponse>("/session");
		const data: SessionResponse = result.success && result.data ? result.data : { authenticated: false };
		cache = { data, ts: Date.now() };
		return data;
	})();

	try {
		return await inflight;
	} finally {
		inflight = null;
	}
}

export function clearSessionCache(): void {
	cache = null;
}

/** Verifica si la sesión actual tiene un permiso bitfield (resource.scope.action). */
export async function sessionHasPermission(resource: string, scope: number, action: CRUDXActionValue): Promise<boolean> {
	const session = await getSession();
	const perms = session.user?.permissions || [];
	return hasAnyPermission(perms, resource, scope, action);
}
