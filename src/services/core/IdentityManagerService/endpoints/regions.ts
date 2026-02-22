import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.js";
import type IdentityManagerService from "../index.js";

/**
 * Endpoints HTTP para gestión de regiones
 */
export class RegionEndpoints {
	static #identity: IdentityManagerService;

	static init(identity: IdentityManagerService): void {
		RegionEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/regions",
		permissions: ["identity.32.1"],
	})
	static async listRegions(_ctx: EndpointCtx) {
		return RegionEndpoints.#identity.regions.getAllRegions();
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/regions/:path",
		permissions: ["identity.32.1"],
	})
	static async getRegion(ctx: EndpointCtx<{ path: string }>) {
		const region = await RegionEndpoints.#identity.regions.getRegion(ctx.params.path);
		if (!region) throw new HttpError(404, "REGION_NOT_FOUND", "Región no encontrada");
		return region;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/regions",
		permissions: ["identity.32.2"],
	})
	static async createRegion(ctx: EndpointCtx<Record<string, string>, { path: string; metadata: any; isGlobal?: boolean }>) {
		if (!ctx.data?.path) {
			throw new HttpError(400, "MISSING_FIELDS", "path es requerido");
		}
		return RegionEndpoints.#identity.regions.createRegion(ctx.data.path, ctx.data.metadata || {}, ctx.data.isGlobal);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/identity/regions/:path",
		permissions: ["identity.32.4"],
	})
	static async updateRegion(ctx: EndpointCtx<{ path: string }, Partial<{ metadata: any; isGlobal: boolean; isActive: boolean }>>) {
		return RegionEndpoints.#identity.regions.updateRegion(ctx.params.path, ctx.data || {});
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/regions/:path",
		permissions: ["identity.32.8"],
	})
	static async deleteRegion(ctx: EndpointCtx<{ path: string }>) {
		await RegionEndpoints.#identity.regions.deleteRegion(ctx.params.path);
		return { success: true };
	}
}
