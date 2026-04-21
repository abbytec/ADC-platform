import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { P } from "@common/types/Permissions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Issue } from "@common/types/project-manager/Issue.ts";
import type { IssueListFilters } from "../dao/issues.ts";

export class IssueEndpoints {
	static #service: ProjectManagerService;
	static init(service: ProjectManagerService): void {
		IssueEndpoints.#service ??= service;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/:projectId/issues",
		permissions: [P.PROJECT_MANAGER.ISSUES.READ],
	})
	static async list(ctx: EndpointCtx<{ projectId: string }>) {
		const project = await IssueEndpoints.#service.projects.getProject(ctx.params.projectId, ctx.token ?? undefined);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");

		const filters: IssueListFilters = {
			sprintId: ctx.query.sprintId || undefined,
			milestoneId: ctx.query.milestoneId || undefined,
			assigneeId: ctx.query.assigneeId || undefined,
			columnKey: ctx.query.columnKey || undefined,
			q: ctx.query.q || undefined,
			orderBy: (ctx.query.orderBy as IssueListFilters["orderBy"]) || undefined,
		};

		const issues = await IssueEndpoints.#service.issues.list(project, filters, ctx.token ?? undefined);
		return { issues, project };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/projects/:projectId/issues",
		permissions: [P.PROJECT_MANAGER.ISSUES.WRITE],
	})
	static async create(ctx: EndpointCtx<{ projectId: string }, Partial<Issue> & { title: string }>) {
		if (!ctx.data?.title) throw new ProjectManagerError(400, "MISSING_FIELDS", "`title` es requerido");
		const project = await IssueEndpoints.#service.projects.getProject(ctx.params.projectId, ctx.token ?? undefined);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
		return IssueEndpoints.#service.issues.create(project, ctx.data, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/issues/:id",
		permissions: [P.PROJECT_MANAGER.ISSUES.READ],
	})
	static async get(ctx: EndpointCtx<{ id: string }>) {
		const issue = await IssueEndpoints.#service.issues.get(ctx.params.id, ctx.token ?? undefined);
		if (!issue) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", "Issue no encontrado");
		return issue;
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/issues/:id",
		permissions: [P.PROJECT_MANAGER.ISSUES.UPDATE],
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Issue> & { reason?: string }>) {
		const { reason, ...updates } = ctx.data ?? {};
		return IssueEndpoints.#service.issues.update(ctx.params.id, updates, reason, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/pm/issues/:id",
		permissions: [P.PROJECT_MANAGER.ISSUES.DELETE],
	})
	static async delete(ctx: EndpointCtx<{ id: string }>) {
		await IssueEndpoints.#service.issues.delete(ctx.params.id, ctx.token ?? undefined);
		return { ok: true };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/issues/:id/move",
		permissions: [P.PROJECT_MANAGER.ISSUES.UPDATE],
	})
	static async move(ctx: EndpointCtx<{ id: string }, { columnKey: string; reason?: string }>) {
		if (!ctx.data?.columnKey) throw new ProjectManagerError(400, "MISSING_FIELDS", "`columnKey` es requerido");
		const issue = await IssueEndpoints.#service.issues.get(ctx.params.id, ctx.token ?? undefined);
		if (!issue) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", "Issue no encontrado");
		const project = await IssueEndpoints.#service.projects.getProject(issue.projectId, ctx.token ?? undefined);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
		return IssueEndpoints.#service.issues.move(project, ctx.params.id, ctx.data.columnKey, ctx.data.reason, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/issues/:id/history",
		permissions: [P.PROJECT_MANAGER.ISSUES.READ],
	})
	static async history(ctx: EndpointCtx<{ id: string }>) {
		const issue = await IssueEndpoints.#service.issues.get(ctx.params.id, ctx.token ?? undefined);
		if (!issue) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", "Issue no encontrado");
		return { updateLog: issue.updateLog };
	}

	/** Stub read-only: uploads requieren `internal-s3-provider` (Fase 6). */
	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/issues/:id/attachments",
		permissions: [P.PROJECT_MANAGER.ATTACHMENTS.WRITE],
	})
	static async upload() {
		throw new ProjectManagerError(501, "ATTACHMENTS_NOT_IMPLEMENTED", "Uploads no disponibles hasta que exista `internal-s3-provider`");
	}
}
