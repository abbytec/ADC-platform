import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { IdentityError } from "@common/types/custom-errors/IdentityError.js";
import type IdentityManagerService from "../index.js";

/**
 * Verifica que el usuario target pertenezca a la org del caller.
 * Admin global (sin orgId) puede operar en cualquier usuario.
 */
async function assertUserOrgAccess(identity: IdentityManagerService, targetUserId: string, callerOrgId?: string): Promise<void> {
	if (!callerOrgId) return;
	const user = await identity.users.getUser(targetUserId);
	if (!user) throw new IdentityError(404, "USER_NOT_FOUND", "Usuario no encontrado");
	const isMember = user.orgMemberships?.some((m) => m.orgId === callerOrgId);
	if (!isMember) throw new IdentityError(403, "ORG_ACCESS_DENIED", "No tienes acceso a este usuario");
}

/**
 * Valida que todos los roleIds sean predefinidos o de la org del caller
 */
async function validateRoleIdsOrg(identity: IdentityManagerService, roleIds: string[], callerOrgId?: string): Promise<void> {
	if (!callerOrgId || !roleIds?.length) return;
	for (const rid of roleIds) {
		const role = await identity.roles.getRole(rid);
		if (!role) throw new IdentityError(400, "INVALID_ROLE", `Rol ${rid} no encontrado`);
		if (role.isCustom && role.orgId !== callerOrgId) {
			throw new IdentityError(403, "CROSS_ORG_ROLE", `No puedes asignar el rol ${role.name} de otra organización`);
		}
	}
}

/**
 * Endpoints HTTP para gestión de usuarios
 * Registrados automáticamente por @EnableEndpoints en IdentityManagerService
 */
export class UserEndpoints {
	static #identity: IdentityManagerService;

	static init(identity: IdentityManagerService): void {
		UserEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/users",
		permissions: ["identity.2.1"],
	})
	static async listUsers(ctx: EndpointCtx) {
		const orgId = ctx.user?.orgId;
		const users = await UserEndpoints.#identity.users.getAllUsers(ctx.token!, orgId);

		// Strip passwordHash from response
		return users.map(({ passwordHash, ...user }) => user);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/users/search",
		permissions: ["identity.2.1"],
	})
	static async searchUsers(ctx: EndpointCtx) {
		const q = ctx.query?.q?.trim();
		if (!q || q.length < 2) return [];
		const orgId = ctx.user?.orgId;
		const users = await UserEndpoints.#identity.users.searchUsers(q, 10, ctx.token!, orgId);

		return users.map(({ passwordHash, ...user }) => user);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/users/:userId",
		permissions: ["identity.2.1"],
	})
	static async getUser(ctx: EndpointCtx<{ userId: string }>) {
		await assertUserOrgAccess(UserEndpoints.#identity, ctx.params.userId, ctx.user?.orgId);
		const user = await UserEndpoints.#identity.users.getUser(ctx.params.userId, ctx.token!);
		if (!user) throw new IdentityError(404, "USER_NOT_FOUND", "Usuario no encontrado");
		const { passwordHash, ...safeUser } = user;
		return safeUser;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/users",
		permissions: ["identity.2.2"],
	})
	static async createUser(ctx: EndpointCtx<Record<string, string>, { username: string; password: string; roleIds?: string[] }>) {
		if (!ctx.data?.username || !ctx.data?.password) {
			throw new IdentityError(400, "MISSING_FIELDS", "username y password son requeridos");
		}
		const callerOrgId = ctx.user?.orgId;
		// Validar que los roleIds asignados sean accesibles para esta org
		if (ctx.data.roleIds?.length) {
			await validateRoleIdsOrg(UserEndpoints.#identity, ctx.data.roleIds, callerOrgId);
		}
		const user = await UserEndpoints.#identity.users.createUser(ctx.data.username, ctx.data.password, ctx.data.roleIds, ctx.token!);
		// Si se crea desde modo org, asociar automáticamente a la organización
		if (callerOrgId) {
			await UserEndpoints.#identity.users.addOrgMembership(user.id, callerOrgId, [], ctx.token!);
		}
		const { passwordHash, ...safeUser } = user;
		return safeUser;
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/identity/users/:userId",
		permissions: ["identity.2.4"],
	})
	static async updateUser(
		ctx: EndpointCtx<
			{ userId: string },
			Partial<{
				username: string;
				email: string;
				isActive: boolean;
				roleIds: string[];
				groupIds: string[];
				permissions: { resource: string; action: number; scope: number }[];
			}>
		>
	) {
		const callerOrgId = ctx.user?.orgId;
		await assertUserOrgAccess(UserEndpoints.#identity, ctx.params.userId, callerOrgId);
		const updates = { ...ctx.data };
		// Prevent updating sensitive fields via API
		delete (updates as any).passwordHash;
		delete (updates as any).id;
		// Validar que los roleIds asignados sean accesibles para esta org
		if (updates.roleIds?.length) {
			await validateRoleIdsOrg(UserEndpoints.#identity, updates.roleIds, callerOrgId);
		}
		const user = await UserEndpoints.#identity.users.updateUser(ctx.params.userId, updates, ctx.token!);
		const { passwordHash, ...safeUser } = user;
		return safeUser;
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/users/:userId",
		permissions: ["identity.2.8"],
	})
	static async deleteUser(ctx: EndpointCtx<{ userId: string }>) {
		await assertUserOrgAccess(UserEndpoints.#identity, ctx.params.userId, ctx.user?.orgId);
		await UserEndpoints.#identity.users.deleteUser(ctx.params.userId, ctx.token!);
		return { success: true };
	}
}
