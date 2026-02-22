import { RegisterEndpoint, type EndpointCtx } from "../../EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.js";
import type IdentityManagerService from "../index.js";

import type { Organization } from "../domain/index.js";

/**
 * Endpoints HTTP para gestión de organizaciones
 */
export class OrgEndpoints {
	static #identity: IdentityManagerService;

	static init(identity: IdentityManagerService): void {
		OrgEndpoints.#identity ??= identity;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/organizations",
		permissions: ["identity.16.1"],
	})
	static async listOrganizations(_ctx: EndpointCtx) {
		return OrgEndpoints.#identity.organizations.getAllOrganizations();
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/identity/organizations/:orgId",
		permissions: ["identity.16.1"],
	})
	static async getOrganization(ctx: EndpointCtx<{ orgId: string }>) {
		const org = await OrgEndpoints.#identity.organizations.getOrganization(ctx.params.orgId);
		if (!org) throw new HttpError(404, "ORG_NOT_FOUND", "Organización no encontrada");
		return org;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/identity/organizations",
		permissions: ["identity.16.2"],
	})
	static async createOrganization(
		ctx: EndpointCtx<Record<string, string>, { slug: string; region?: string; metadata?: Record<string, any> }>
	) {
		if (!ctx.data?.slug) {
			throw new HttpError(400, "MISSING_FIELDS", "slug es requerido");
		}
		return OrgEndpoints.#identity.organizations.createOrganization(ctx.data.slug, ctx.data.region, ctx.data.metadata);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/identity/organizations/:orgId",
		permissions: ["identity.16.4"],
	})
	static async updateOrganization(
		ctx: EndpointCtx<{ orgId: string }, Partial<Pick<Organization, "slug" | "region" | "status" | "metadata">>>
	) {
		return OrgEndpoints.#identity.organizations.updateOrganization(ctx.params.orgId, ctx.data || {});
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/identity/organizations/:orgId",
		permissions: ["identity.16.8"],
	})
	static async deleteOrganization(ctx: EndpointCtx<{ orgId: string }>) {
		await OrgEndpoints.#identity.organizations.deleteOrganization(ctx.params.orgId);
		return { success: true };
	}
}
