import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { IdentityError } from "@common/types/custom-errors/IdentityError.js";
import type IdentityManagerService from "../index.js";

/**
 * Verifica que un grupo pertenezca a la org del usuario.
 * Admin global (sin orgId) puede operar en cualquier grupo.
 */
async function assertGroupOrgAccess(identity: IdentityManagerService, groupId: string, callerOrgId?: string): Promise<void> {
	if (!callerOrgId) return;
	const group = await identity.groups.getGroup(groupId);
	if (!group) throw new IdentityError(404, "GROUP_NOT_FOUND", "Grupo no encontrado");
	if (group.orgId !== callerOrgId) throw new IdentityError(403, "ORG_ACCESS_DENIED", "No tienes acceso a este grupo");
}

/**
 * Verifica que un usuario pertenezca a la org del caller
 */
async function assertUserInOrg(identity: IdentityManagerService, userId: string, callerOrgId?: string): Promise<void> {
	if (!callerOrgId) return;
	const user = await identity.users.getUser(userId);
	if (!user) throw new IdentityError(404, "USER_NOT_FOUND", "Usuario no encontrado");
	const isMember = user.orgMemberships?.some((m) => m.orgId === callerOrgId);
	if (!isMember) throw new IdentityError(403, "CROSS_ORG_USER", "El usuario no pertenece a tu organización");
}

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
		const orgId = ctx.user?.orgId;
		return GroupEndpoints.#identity.groups.getAllGroups(ctx.token!, orgId);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/groups/:groupId",
		permissions: ["identity.8.1"],
	})
	static async getGroup(ctx: EndpointCtx<{ groupId: string }>) {
		const group = await GroupEndpoints.#identity.groups.getGroup(ctx.params.groupId, ctx.token!);
		if (!group) throw new IdentityError(404, "GROUP_NOT_FOUND", "Grupo no encontrado");
		const callerOrgId = ctx.user?.orgId;
		if (callerOrgId && group.orgId !== callerOrgId) {
			throw new IdentityError(403, "ORG_ACCESS_DENIED", "No tienes acceso a este grupo");
		}
		return group;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/groups",
		permissions: ["identity.8.2"],
	})
	static async createGroup(ctx: EndpointCtx<Record<string, string>, { name: string; description: string; roleIds?: string[] }>) {
		if (!ctx.data?.name) {
			throw new IdentityError(400, "MISSING_FIELDS", "name es requerido");
		}
		const orgId = ctx.user?.orgId;
		return GroupEndpoints.#identity.groups.createGroup(ctx.data.name, ctx.data.description || "", ctx.data.roleIds, ctx.token!, orgId);
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
		await assertGroupOrgAccess(GroupEndpoints.#identity, ctx.params.groupId, ctx.user?.orgId);
		return GroupEndpoints.#identity.groups.updateGroup(ctx.params.groupId, ctx.data || {}, ctx.token!);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/groups/:groupId",
		permissions: ["identity.8.8"],
	})
	static async deleteGroup(ctx: EndpointCtx<{ groupId: string }>) {
		await assertGroupOrgAccess(GroupEndpoints.#identity, ctx.params.groupId, ctx.user?.orgId);
		await GroupEndpoints.#identity.groups.deleteGroup(ctx.params.groupId, ctx.token!);
		return { success: true };
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/groups/:groupId/users",
		permissions: ["identity.8.1"],
	})
	static async listGroupMembers(ctx: EndpointCtx<{ groupId: string }>) {
		await assertGroupOrgAccess(GroupEndpoints.#identity, ctx.params.groupId, ctx.user?.orgId);
		return GroupEndpoints.#identity.groups.getGroupUsers(ctx.params.groupId, ctx.token!);
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/groups/:groupId/users/:userId",
		permissions: ["identity.10.2"],
	})
	static async addUserToGroup(ctx: EndpointCtx<{ groupId: string; userId: string }>) {
		const callerOrgId = ctx.user?.orgId;
		await assertGroupOrgAccess(GroupEndpoints.#identity, ctx.params.groupId, callerOrgId);
		await assertUserInOrg(GroupEndpoints.#identity, ctx.params.userId, callerOrgId);
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
