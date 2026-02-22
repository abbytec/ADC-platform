import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.js";
import type IdentityManagerService from "../index.js";

/**
 * Endpoints HTTP para gestión de grupos
 */
export class GroupEndpoints {
	static #identity: IdentityManagerService;

	static init(identity: IdentityManagerService): void {
		GroupEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/groups",
		permissions: ["identity.8.1"],
	})
	static async listGroups(ctx: EndpointCtx) {
		return GroupEndpoints.#identity.groups.getAllGroups(ctx.token!);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/groups/:groupId",
		permissions: ["identity.8.1"],
	})
	static async getGroup(ctx: EndpointCtx<{ groupId: string }>) {
		const group = await GroupEndpoints.#identity.groups.getGroup(ctx.params.groupId, ctx.token!);
		if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Grupo no encontrado");
		return group;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/groups",
		permissions: ["identity.8.2"],
	})
	static async createGroup(ctx: EndpointCtx<Record<string, string>, { name: string; description: string; roleIds?: string[] }>) {
		if (!ctx.data?.name) {
			throw new HttpError(400, "MISSING_FIELDS", "name es requerido");
		}
		return GroupEndpoints.#identity.groups.createGroup(ctx.data.name, ctx.data.description || "", ctx.data.roleIds, ctx.token!);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/identity/groups/:groupId",
		permissions: ["identity.8.4"],
	})
	static async updateGroup(
		ctx: EndpointCtx<
			{ groupId: string },
			Partial<{ name: string; description: string; roleIds: string[]; permissions: { resource: string; action: number; scope: number }[] }>
		>
	) {
		return GroupEndpoints.#identity.groups.updateGroup(ctx.params.groupId, ctx.data || {}, ctx.token!);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/groups/:groupId",
		permissions: ["identity.8.8"],
	})
	static async deleteGroup(ctx: EndpointCtx<{ groupId: string }>) {
		await GroupEndpoints.#identity.groups.deleteGroup(ctx.params.groupId, ctx.token!);
		return { success: true };
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/groups/:groupId/users",
		permissions: ["identity.8.1"],
	})
	static async listGroupMembers(ctx: EndpointCtx<{ groupId: string }>) {
		return GroupEndpoints.#identity.groups.getGroupUsers(ctx.params.groupId, ctx.token!);
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/groups/:groupId/users/:userId",
		permissions: ["identity.10.2"],
	})
	static async addUserToGroup(ctx: EndpointCtx<{ groupId: string; userId: string }>) {
		await GroupEndpoints.#identity.groups.addUserToGroup(ctx.params.userId, ctx.params.groupId, ctx.token!);
		return { success: true };
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/groups/:groupId/users/:userId",
		permissions: ["identity.10.8"],
	})
	static async removeUserFromGroup(ctx: EndpointCtx<{ groupId: string; userId: string }>) {
		await GroupEndpoints.#identity.groups.removeUserFromGroup(ctx.params.userId, ctx.params.groupId, ctx.token!);
		return { success: true };
	}
}
