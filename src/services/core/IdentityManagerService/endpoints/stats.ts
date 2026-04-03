import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { IdentityError } from "@common/types/custom-errors/IdentityError.js";
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
	static async getStats(ctx: EndpointCtx) {
		if (ctx.user?.orgId) {
			throw new IdentityError(403, "GLOBAL_ONLY", "Las estadísticas globales requieren acceso global (modo personal)");
		}
		return StatsEndpoints.#identity.getStats();
	}

	/**
	 * Retorna los permisos del usuario autenticado sobre el recurso identity.
	 * Incluye orgId del contexto actual, indicador de admin global e indicador de admin de org.
	 * Usado por el frontend para determinar qué tabs mostrar y filtrar datos.
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/my-permissions",
		permissions: [],
	})
	static async getMyPermissions(ctx: EndpointCtx) {
		if (!ctx.user) {
			return { scopes: [], orgId: null, isAdmin: false, isOrgAdmin: false };
		}

		try {
			const orgId = ctx.user.orgId || null;
			const resolved = await StatsEndpoints.#identity.permissions.resolvePermissions(ctx.user.id, orgId || undefined);
			// Filtrar solo permisos del recurso "identity"
			const identityPerms = resolved.filter((p) => p.resource === "identity" && p.granted);

			const user = await StatsEndpoints.#identity.users.getUser(ctx.user.id);

			// Determinar si el usuario es admin global (tiene rol Admin en roleIds globales)
			let hasGlobalAdminRole = false;
			if (user?.roleIds?.length) {
				for (const roleId of user.roleIds) {
					const role = await StatsEndpoints.#identity.roles.getRole(roleId);
					if (role?.name === SystemRole.ADMIN && !role.orgId) {
						hasGlobalAdminRole = true;
						break;
					}
				}
			}

			// Determinar si es admin dentro de la org actual (rol Admin en orgMemberships)
			let isOrgAdmin = false;
			if (orgId && user?.orgMemberships?.length) {
				const membership = user.orgMemberships.find((m) => m.orgId === orgId);
				if (membership?.roleIds?.length) {
					for (const roleId of membership.roleIds) {
						const role = await StatsEndpoints.#identity.roles.getRole(roleId);
						if (role?.name === SystemRole.ADMIN) {
							isOrgAdmin = true;
							break;
						}
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
				isAdmin: !orgId && hasGlobalAdminRole,
				isOrgAdmin,
			};
		} catch {
			return { scopes: [], orgId: null, isAdmin: false, isOrgAdmin: false };
		}
	}
}
