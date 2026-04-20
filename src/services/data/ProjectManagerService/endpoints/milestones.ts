import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { P } from "@common/types/Permissions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";

export class MilestoneEndpoints {
	static #service: ProjectManagerService;
	static init(service: ProjectManagerService): void {
		MilestoneEndpoints.#service ??= service;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/:projectId/milestones",
		permissions: [P.PROJECT_MANAGER.MILESTONES.READ],
	})
	static async list(ctx: EndpointCtx<{ projectId: string }>) {
		return { milestones: await MilestoneEndpoints.#service.milestones.list(ctx.params.projectId, ctx.token ?? undefined) };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/projects/:projectId/milestones",
		permissions: [P.PROJECT_MANAGER.MILESTONES.WRITE],
	})
	static async create(ctx: EndpointCtx<{ projectId: string }, Partial<Milestone> & { name: string }>) {
		if (!ctx.data?.name) throw new ProjectManagerError(400, "MISSING_FIELDS", "`name` es requerido");
		return MilestoneEndpoints.#service.milestones.create(ctx.params.projectId, ctx.data, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/milestones/:id",
		permissions: [P.PROJECT_MANAGER.MILESTONES.UPDATE],
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Milestone>>) {
		return MilestoneEndpoints.#service.milestones.update(ctx.params.id, ctx.data ?? {}, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/pm/milestones/:id",
		permissions: [P.PROJECT_MANAGER.MILESTONES.DELETE],
	})
	static async delete(ctx: EndpointCtx<{ id: string }>) {
		await MilestoneEndpoints.#service.milestones.delete(ctx.params.id, ctx.token ?? undefined);
		return { ok: true };
	}
}
