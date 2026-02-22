import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import type IdentityManagerService from "../index.js";
import { SystemRole } from "../defaults/systemRoles.js";

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
	 * Incluye orgId del contexto actual e indicador de admin.
	 * Usado por el frontend para determinar qué tabs mostrar y filtrar datos.
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/my-permissions",
		permissions: [],
	})
	static async getMyPermissions(ctx: EndpointCtx) {
		if (!ctx.user) {
			return { scopes: [], orgId: null, isAdmin: false };
		}

		try {
			const orgId = ctx.user.orgId || null;
			const resolved = await StatsEndpoints.#identity.permissions.resolvePermissions(ctx.user.id, orgId || undefined);
			// Filtrar solo permisos del recurso "identity"
			const identityPerms = resolved.filter((p) => p.resource === "identity" && p.granted);

			// Determinar si el usuario es admin (tiene rol admin global)
			const user = await StatsEndpoints.#identity.users.getUser(ctx.user.id);
			let isAdmin = false;
			if (user?.roleIds?.length) {
				for (const roleId of user.roleIds) {
					const role = await StatsEndpoints.#identity.roles.getRole(roleId);
					if (role?.name === SystemRole.ADMIN) {
						isAdmin = true;
						break;
					}
				}
			}

			return {
				scopes: identityPerms.map((p) => ({
					action: p.action,
					scope: p.scope,
					source: p.source,
				})),
				orgId,
				isAdmin,
			};
		} catch {
			return { scopes: [], orgId: null, isAdmin: false };
		}
	}
}
