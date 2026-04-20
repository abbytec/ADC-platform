import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { P } from "@common/types/Permissions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";

export class SprintEndpoints {
	static #service: ProjectManagerService;
	static init(service: ProjectManagerService): void {
		SprintEndpoints.#service ??= service;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/:projectId/sprints",
		permissions: [P.PROJECT_MANAGER.SPRINTS.READ],
	})
	static async list(ctx: EndpointCtx<{ projectId: string }>) {
		return { sprints: await SprintEndpoints.#service.sprints.list(ctx.params.projectId, ctx.token ?? undefined) };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/projects/:projectId/sprints",
		permissions: [P.PROJECT_MANAGER.SPRINTS.WRITE],
	})
	static async create(ctx: EndpointCtx<{ projectId: string }, Partial<Sprint> & { name: string }>) {
		if (!ctx.data?.name) throw new ProjectManagerError(400, "MISSING_FIELDS", "`name` es requerido");
		return SprintEndpoints.#service.sprints.create(ctx.params.projectId, ctx.data, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/sprints/:id",
		permissions: [P.PROJECT_MANAGER.SPRINTS.UPDATE],
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Sprint>>) {
		return SprintEndpoints.#service.sprints.update(ctx.params.id, ctx.data ?? {}, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/pm/sprints/:id",
		permissions: [P.PROJECT_MANAGER.SPRINTS.DELETE],
	})
	static async delete(ctx: EndpointCtx<{ id: string }>) {
		await SprintEndpoints.#service.sprints.delete(ctx.params.id, ctx.token ?? undefined);
		return { ok: true };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/sprints/:id/start",
		permissions: [P.PROJECT_MANAGER.SPRINTS.UPDATE],
	})
	static async start(ctx: EndpointCtx<{ id: string }>) {
		return SprintEndpoints.#service.sprints.setStatus(ctx.params.id, "active", ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/sprints/:id/complete",
		permissions: [P.PROJECT_MANAGER.SPRINTS.UPDATE],
	})
	static async complete(ctx: EndpointCtx<{ id: string }>) {
		return SprintEndpoints.#service.sprints.setStatus(ctx.params.id, "completed", ctx.token ?? undefined);
	}
}
