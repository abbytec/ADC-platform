import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";

export class SprintEndpoints {
	static #service: ProjectManagerService;
	static #kernelKey: symbol;
	static init(service: ProjectManagerService, kernelKey: symbol): void {
		SprintEndpoints.#service ??= service;
		SprintEndpoints.#kernelKey ??= kernelKey;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/:projectId/sprints",
		deferAuth: true,
	})
	static async list(ctx: EndpointCtx<{ projectId: string }>) {
		const service = SprintEndpoints.#service;
		const caller = await service.resolveCaller(SprintEndpoints.#kernelKey, ctx);
		return { sprints: await service.sprints.list(ctx.params.projectId, ctx.token ?? undefined, caller) };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/projects/:projectId/sprints",
		deferAuth: true,
	})
	static async create(ctx: EndpointCtx<{ projectId: string }, Partial<Sprint> & { name: string }>) {
		if (!ctx.data?.name) throw new ProjectManagerError(400, "MISSING_FIELDS", "`name` es requerido");
		const service = SprintEndpoints.#service;
		const caller = await service.resolveCaller(SprintEndpoints.#kernelKey, ctx);
		return service.sprints.create(ctx.params.projectId, ctx.data, ctx.token ?? undefined, caller);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/sprints/:id",
		deferAuth: true,
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Sprint>>) {
		const service = SprintEndpoints.#service;
		const caller = await service.resolveCaller(SprintEndpoints.#kernelKey, ctx);
		return service.sprints.update(ctx.params.id, ctx.data ?? {}, ctx.token ?? undefined, caller);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/pm/sprints/:id",
		deferAuth: true,
	})
	static async delete(ctx: EndpointCtx<{ id: string }>) {
		const service = SprintEndpoints.#service;
		const caller = await service.resolveCaller(SprintEndpoints.#kernelKey, ctx);
		await service.sprints.delete(ctx.params.id, ctx.token ?? undefined, caller);
		return { ok: true };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/sprints/:id/start",
		deferAuth: true,
	})
	static async start(ctx: EndpointCtx<{ id: string }>) {
		const service = SprintEndpoints.#service;
		const caller = await service.resolveCaller(SprintEndpoints.#kernelKey, ctx);
		return service.sprints.setStatus(ctx.params.id, "active", ctx.token ?? undefined, caller);
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/sprints/:id/complete",
		deferAuth: true,
	})
	static async complete(ctx: EndpointCtx<{ id: string }>) {
		const service = SprintEndpoints.#service;
		const caller = await service.resolveCaller(SprintEndpoints.#kernelKey, ctx);
		return service.sprints.setStatus(ctx.params.id, "completed", ctx.token ?? undefined, caller);
	}
}
