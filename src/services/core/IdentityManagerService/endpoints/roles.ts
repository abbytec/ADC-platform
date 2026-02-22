import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { IdentityError } from "@common/types/custom-errors/IdentityError.js";
import type IdentityManagerService from "../index.js";

/**
 * Verifica que un rol pertenezca a la org del usuario (o sea predefinido).
 * Admin global (sin orgId) puede operar en cualquier rol.
 */
async function assertRoleOrgAccess(identity: IdentityManagerService, roleId: string, callerOrgId?: string): Promise<void> {
	if (!callerOrgId) return; // Admin global: sin restricción
	const role = await identity.roles.getRole(roleId);
	if (!role) throw new IdentityError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
	if (!role.isCustom) throw new IdentityError(403, "CANNOT_MODIFY_PREDEFINED", "No se pueden modificar roles predefinidos");
	if (role.orgId !== callerOrgId) throw new IdentityError(403, "ORG_ACCESS_DENIED", "No tienes acceso a este rol");
}

/**
 * Endpoints HTTP para gestión de roles
 */
export class RoleEndpoints {
	static #identity: IdentityManagerService;

	static init(identity: IdentityManagerService): void {
		RoleEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/roles",
		permissions: ["identity.4.1"],
	})
	static async listRoles(ctx: EndpointCtx) {
		const orgId = ctx.user?.orgId;
		return RoleEndpoints.#identity.roles.getAllRoles(ctx.token!, orgId);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/roles/:roleId",
		permissions: ["identity.4.1"],
	})
	static async getRole(ctx: EndpointCtx<{ roleId: string }>) {
		const role = await RoleEndpoints.#identity.roles.getRole(ctx.params.roleId, ctx.token!);
		if (!role) throw new IdentityError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
		// En modo org: solo ver roles predefinidos o de tu org
		const callerOrgId = ctx.user?.orgId;
		if (callerOrgId && role.isCustom && role.orgId !== callerOrgId) {
			throw new IdentityError(403, "ORG_ACCESS_DENIED", "No tienes acceso a este rol");
		}
		return role;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/roles",
		permissions: ["identity.4.2"],
	})
	static async createRole(ctx: EndpointCtx<Record<string, string>, { name: string; description: string; permissions?: any[] }>) {
		if (!ctx.data?.name) {
			throw new IdentityError(400, "MISSING_FIELDS", "name es requerido");
		}
		const orgId = ctx.user?.orgId;
		return RoleEndpoints.#identity.roles.createRole(ctx.data.name, ctx.data.description || "", ctx.data.permissions, ctx.token!, orgId);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/identity/roles/:roleId",
		permissions: ["identity.4.4"],
	})
	static async updateRole(ctx: EndpointCtx<{ roleId: string }, Partial<{ name: string; description: string; permissions: any[] }>>) {
		await assertRoleOrgAccess(RoleEndpoints.#identity, ctx.params.roleId, ctx.user?.orgId);
		return RoleEndpoints.#identity.roles.updateRole(ctx.params.roleId, ctx.data || {}, ctx.token!);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/roles/:roleId",
		permissions: ["identity.4.8"],
	})
	static async deleteRole(ctx: EndpointCtx<{ roleId: string }>) {
		try {
			await assertRoleOrgAccess(RoleEndpoints.#identity, ctx.params.roleId, ctx.user?.orgId);
			await RoleEndpoints.#identity.roles.deleteRole(ctx.params.roleId, ctx.token!);
			return { success: true };
		} catch (error: any) {
			if (error.message?.includes("no encontrado")) {
				throw new IdentityError(404, "ROLE_NOT_FOUND", error.message);
			}
			if (error.message?.includes("predefinidos")) {
				throw new IdentityError(403, "CANNOT_DELETE_PREDEFINED", error.message);
			}
			throw error;
		}
	}
}
