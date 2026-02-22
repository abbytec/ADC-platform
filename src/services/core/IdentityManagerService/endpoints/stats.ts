import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import type IdentityManagerService from "../index.js";

/**
 * Endpoint para obtener estadísticas y permisos del usuario actual
 */
export class StatsEndpoints {
	static #identity: IdentityManagerService;

	static init(identity: IdentityManagerService): void {
		StatsEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/stats",
		permissions: ["identity.64.1"],
	})
	static async getStats(_ctx: EndpointCtx) {
		return StatsEndpoints.#identity.getStats();
	}

	/**
	 * Retorna los permisos del usuario autenticado sobre el recurso identity.
	 * Usado por el frontend para determinar qué tabs mostrar.
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/my-permissions",
		permissions: [],
	})
	static async getMyPermissions(ctx: EndpointCtx) {
		if (!ctx.user) {
			return { scopes: [] };
		}

		try {
			const resolved = await StatsEndpoints.#identity.permissions.resolvePermissions(ctx.user.id);
			// Filtrar solo permisos del recurso "identity"
			const identityPerms = resolved.filter((p) => p.resource === "identity" && p.granted);
			return {
				scopes: identityPerms.map((p) => ({
					action: p.action,
					scope: p.scope,
					source: p.source,
				})),
			};
		} catch {
			return { scopes: [] };
		}
	}
}
