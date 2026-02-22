import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.js";
import type IdentityManagerService from "../index.js";

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
		const user = await UserEndpoints.#identity.users.getUser(ctx.params.userId, ctx.token!);
		if (!user) throw new HttpError(404, "USER_NOT_FOUND", "Usuario no encontrado");
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
			throw new HttpError(400, "MISSING_FIELDS", "username y password son requeridos");
		}
		const user = await UserEndpoints.#identity.users.createUser(ctx.data.username, ctx.data.password, ctx.data.roleIds, ctx.token!);
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
		const updates = { ...ctx.data };
		// Prevent updating sensitive fields via API
		delete (updates as any).passwordHash;
		delete (updates as any).id;
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
		await UserEndpoints.#identity.users.deleteUser(ctx.params.userId, ctx.token!);
		return { success: true };
	}
}
