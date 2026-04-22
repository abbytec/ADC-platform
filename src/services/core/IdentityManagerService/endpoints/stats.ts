import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { IdentityError } from "@common/types/custom-errors/IdentityError.js";
import { P } from "@common/types/Permissions.ts";
import type IdentityManagerService from "../index.js";
import { SystemRole } from "../defaults/systemRoles.js";

/**
 * Endpoint para obtener estadísticas y permisos del usuario actual
 */
export class StatsEndpoints {
	static #identity: IdentityManagerService;

	static #emptyPermissions() {
		return { scopes: [], orgId: null, isAdmin: false, isOrgAdmin: false };
	}

	static async #hasGlobalAdminRole(user: Awaited<ReturnType<IdentityManagerService["users"]["getUser"]>>, token?: string) {
		if (!user?.roleIds?.length) return false;

		for (const roleId of user.roleIds) {
			const role = await StatsEndpoints.#identity.roles.getRole(roleId, token);
			if (role?.name === SystemRole.ADMIN && !role.orgId) {
				return true;
			}
		}

		return false;
	}

	static async #isOrgAdmin(user: Awaited<ReturnType<IdentityManagerService["users"]["getUser"]>>, orgId: string | null, token?: string) {
		if (!orgId || !user?.orgMemberships?.length) return false;

		const membership = user.orgMemberships.find((item) => item.orgId === orgId);
		if (!membership?.roleIds?.length) return false;

		for (const roleId of membership.roleIds) {
			const role = await StatsEndpoints.#identity.roles.getRole(roleId, token);
			if (role?.name === SystemRole.ADMIN) {
				return true;
			}
		}

		return false;
	}

	static init(identity: IdentityManagerService): void {
		StatsEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/stats",
		permissions: [P.IDENTITY.STATS.READ],
	})
	static async getStats(ctx: EndpointCtx) {
		if (ctx.user?.orgId) {
			throw new IdentityError(403, "GLOBAL_ONLY", "Las estadísticas globales requieren acceso global (modo personal)");
		}
		return StatsEndpoints.#identity.getStats(ctx.token!);
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
			return StatsEndpoints.#emptyPermissions();
		}

		try {
			const orgId = ctx.user.orgId || null;
			const resolved = await StatsEndpoints.#identity.permissions.resolvePermissions(ctx.user.id, orgId || undefined);
			const user = await StatsEndpoints.#identity.users.getUser(ctx.user.id, ctx.token!);
			const [hasGlobalAdminRole, isOrgAdmin] = await Promise.all([
				StatsEndpoints.#hasGlobalAdminRole(user, ctx.token!),
				StatsEndpoints.#isOrgAdmin(user, orgId, ctx.token!),
			]);

			return {
				perms: resolved,
				orgId,
				isAdmin: !orgId && hasGlobalAdminRole,
				isOrgAdmin,
			};
		} catch {
			return StatsEndpoints.#emptyPermissions();
		}
	}
}
