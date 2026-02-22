import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.js";
import type IdentityManagerService from "../index.js";

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
		if (!role) throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
		return role;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/roles",
		permissions: ["identity.4.2"],
	})
	static async createRole(ctx: EndpointCtx<Record<string, string>, { name: string; description: string; permissions?: any[] }>) {
		if (!ctx.data?.name) {
			throw new HttpError(400, "MISSING_FIELDS", "name es requerido");
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
		return RoleEndpoints.#identity.roles.updateRole(ctx.params.roleId, ctx.data || {}, ctx.token!);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/roles/:roleId",
		permissions: ["identity.4.8"],
	})
	static async deleteRole(ctx: EndpointCtx<{ roleId: string }>) {
		try {
			await RoleEndpoints.#identity.roles.deleteRole(ctx.params.roleId, ctx.token!);
			return { success: true };
		} catch (error: any) {
			if (error.message?.includes("no encontrado")) {
				throw new HttpError(404, "ROLE_NOT_FOUND", error.message);
			}
			if (error.message?.includes("predefinidos")) {
				throw new HttpError(403, "CANNOT_DELETE_PREDEFINED", error.message);
			}
			throw error;
		}
	}
}
