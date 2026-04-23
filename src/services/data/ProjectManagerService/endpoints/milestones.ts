import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";

export class MilestoneEndpoints {
	static #service: ProjectManagerService;
	static #kernelKey: symbol;
	static init(service: ProjectManagerService, kernelKey: symbol): void {
		MilestoneEndpoints.#service ??= service;
		MilestoneEndpoints.#kernelKey ??= kernelKey;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/:projectId/milestones",
		deferAuth: true,
	})
	static async list(ctx: EndpointCtx<{ projectId: string }>) {
		const service = MilestoneEndpoints.#service;
		const caller = await service.resolveCaller(MilestoneEndpoints.#kernelKey, ctx);
		return { milestones: await service.milestones.list(ctx.params.projectId, ctx.token ?? undefined, caller) };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/projects/:projectId/milestones",
		deferAuth: true,
	})
	static async create(ctx: EndpointCtx<{ projectId: string }, Partial<Milestone> & { name: string }>) {
		if (!ctx.data?.name) throw new ProjectManagerError(400, "MISSING_FIELDS", "`name` es requerido");
		const service = MilestoneEndpoints.#service;
		const caller = await service.resolveCaller(MilestoneEndpoints.#kernelKey, ctx);
		return service.milestones.create(ctx.params.projectId, ctx.data, ctx.token ?? undefined, caller);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/milestones/:id",
		deferAuth: true,
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Milestone>>) {
		const service = MilestoneEndpoints.#service;
		const caller = await service.resolveCaller(MilestoneEndpoints.#kernelKey, ctx);
		return service.milestones.update(ctx.params.id, ctx.data ?? {}, ctx.token ?? undefined, caller);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/pm/milestones/:id",
		deferAuth: true,
	})
	static async delete(ctx: EndpointCtx<{ id: string }>) {
		const service = MilestoneEndpoints.#service;
		const caller = await service.resolveCaller(MilestoneEndpoints.#kernelKey, ctx);
		await service.milestones.delete(ctx.params.id, ctx.token ?? undefined, caller);
		return { ok: true };
	}
}
