import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { P } from "@common/types/Permissions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Project, KanbanColumn, ProjectSettings, PriorityStrategy } from "@common/types/project-manager/Project.ts";
import type { CustomFieldDef } from "@common/types/project-manager/CustomField.ts";
import type { IssueLinkType } from "@common/types/project-manager/IssueLink.ts";

/** Resuelve un orgSlug a un orgId (null si es "default" = contexto global). */
async function resolveOrgSlug(service: ProjectManagerService, orgSlug: string, token?: string): Promise<string | null> {
	const slug = orgSlug.toLowerCase();
	if (slug === "default") return null;
	const identity = service.identity;
	const org = await identity.organizations.getOrganization(slug, token);
	if (!org) throw new ProjectManagerError(404, "ORG_ACCESS_DENIED", `Organización '${orgSlug}' no encontrada`);
	return org.orgId;
}

export class ProjectEndpoints {
	static #service: ProjectManagerService;
	static #kernelKey: symbol;
	static init(service: ProjectManagerService, kernelKey: symbol): void {
		ProjectEndpoints.#service ??= service;
		ProjectEndpoints.#kernelKey ??= kernelKey;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects",
		deferAuth: true,
	})
	static async list(ctx: EndpointCtx) {
		const service = ProjectEndpoints.#service;
		if (!ctx.user?.id) {
			throw new ProjectManagerError(401, "NO_TOKEN", "Token de autenticación requerido");
		}
		const projects = await service.listProjectsForCaller(ProjectEndpoints.#kernelKey, ctx);
		return { projects };
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/check-slug/:orgSlug/:projectSlug",
		deferAuth: true,
	})
	static async checkSlug(ctx: EndpointCtx<{ orgSlug: string; projectSlug: string }>) {
		const service = ProjectEndpoints.#service;
		const projectSlug = ctx.params.projectSlug.toLowerCase().trim();
		if (!/^[a-z0-9-]+$/.test(projectSlug)) {
			return { available: false };
		}
		const orgId = await resolveOrgSlug(service, ctx.params.orgSlug, ctx.token ?? undefined);
		const available = await service.projects.isSlugAvailable(projectSlug, orgId, ctx.token ?? undefined);
		return { available };
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/by-slug/:orgSlug/:projectSlug",
		deferAuth: true,
	})
	static async getBySlug(ctx: EndpointCtx<{ orgSlug: string; projectSlug: string }>) {
		const service = ProjectEndpoints.#service;
		const caller = await service.resolveCaller(ProjectEndpoints.#kernelKey, ctx);
		const orgId = await resolveOrgSlug(service, ctx.params.orgSlug, ctx.token ?? undefined);
		const project = await service.projects.getProjectBySlug(ctx.params.projectSlug.toLowerCase(), orgId, ctx.token ?? undefined, caller);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
		return project;
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/pm/projects",
		permissions: [P.PROJECT_MANAGER.PROJECTS.WRITE],
	})
	static async create(ctx: EndpointCtx<Record<string, string>, Partial<Project> & { name: string; slug: string }>) {
		if (!ctx.data?.name || !ctx.data?.slug) {
			throw new ProjectManagerError(400, "MISSING_FIELDS", "`name` y `slug` son requeridos");
		}
		const orgId = ctx.data.orgId ?? ctx.user?.orgId ?? null;
		const project = await ProjectEndpoints.#service.projects.createProject(
			{ ...ctx.data, orgId, ownerId: ctx.data.ownerId ?? ctx.user?.id ?? "" },
			ctx.token ?? undefined
		);
		return project;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/:id",
		deferAuth: true,
	})
	static async get(ctx: EndpointCtx<{ id: string }>) {
		const service = ProjectEndpoints.#service;
		const caller = await service.resolveCaller(ProjectEndpoints.#kernelKey, ctx);
		const project = await service.projects.getProject(ctx.params.id, ctx.token ?? undefined, caller);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
		return project;
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id",
		deferAuth: true,
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Project>>) {
		const service = ProjectEndpoints.#service;
		const caller = await service.resolveCaller(ProjectEndpoints.#kernelKey, ctx);
		return service.projects.updateProject(ctx.params.id, ctx.data ?? {}, ctx.token ?? undefined, caller);
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/pm/projects/:id",
		permissions: [P.PROJECT_MANAGER.PROJECTS.DELETE],
	})
	static async delete(ctx: EndpointCtx<{ id: string }>) {
		await ProjectEndpoints.#service.projects.deleteProject(ctx.params.id, ctx.token ?? undefined);
		return { ok: true };
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id/members",
		permissions: [P.PROJECT_MANAGER.PROJECTS.UPDATE],
	})
	static async updateMembers(ctx: EndpointCtx<{ id: string }, { memberUserIds: string[]; memberGroupIds: string[] }>) {
		const data = ctx.data ?? { memberUserIds: [], memberGroupIds: [] };
		if (!Array.isArray(data.memberUserIds) || !Array.isArray(data.memberGroupIds)) {
			throw new ProjectManagerError(400, "INVALID_FIELD", "`memberUserIds` y `memberGroupIds` deben ser arrays");
		}
		return ProjectEndpoints.#service.projects.updateProject(
			ctx.params.id,
			{ memberUserIds: data.memberUserIds, memberGroupIds: data.memberGroupIds },
			ctx.token ?? undefined
		);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id/columns",
		permissions: [P.PROJECT_MANAGER.SETTINGS.UPDATE],
	})
	static async updateColumns(ctx: EndpointCtx<{ id: string }, { kanbanColumns: KanbanColumn[] }>) {
		const columns = ctx.data?.kanbanColumns;
		if (!Array.isArray(columns)) throw new ProjectManagerError(400, "INVALID_FIELD", "`kanbanColumns` debe ser un array");
		return ProjectEndpoints.#service.projects.updateProject(ctx.params.id, { kanbanColumns: columns }, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id/custom-fields",
		permissions: [P.PROJECT_MANAGER.CUSTOM_FIELDS.UPDATE],
	})
	static async updateCustomFields(ctx: EndpointCtx<{ id: string }, { customFieldDefs: CustomFieldDef[] }>) {
		const defs = ctx.data?.customFieldDefs;
		if (!Array.isArray(defs)) throw new ProjectManagerError(400, "INVALID_FIELD", "`customFieldDefs` debe ser un array");
		for (const def of defs) {
			if (def.type === "label" && (!Array.isArray(def.options) || def.options.length === 0)) {
				throw new ProjectManagerError(400, "INVALID_FIELD", `Campo '${def.name}' tipo 'label' requiere opciones`);
			}
		}
		return ProjectEndpoints.#service.projects.updateProject(ctx.params.id, { customFieldDefs: defs }, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id/link-types",
		permissions: [P.PROJECT_MANAGER.SETTINGS.UPDATE],
	})
	static async updateLinkTypes(ctx: EndpointCtx<{ id: string }, { issueLinkTypes: IssueLinkType[] }>) {
		const types = ctx.data?.issueLinkTypes;
		if (!Array.isArray(types)) throw new ProjectManagerError(400, "INVALID_FIELD", "`issueLinkTypes` debe ser un array");
		return ProjectEndpoints.#service.projects.updateProject(ctx.params.id, { issueLinkTypes: types }, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id/priority-strategy",
		permissions: [P.PROJECT_MANAGER.SETTINGS.UPDATE],
	})
	static async updatePriorityStrategy(ctx: EndpointCtx<{ id: string }, { priorityStrategy: PriorityStrategy }>) {
		const strategy = ctx.data?.priorityStrategy;
		if (!strategy || !strategy.id) throw new ProjectManagerError(400, "INVALID_FIELD", "`priorityStrategy.id` es requerido");
		return ProjectEndpoints.#service.projects.updateProject(ctx.params.id, { priorityStrategy: strategy }, ctx.token ?? undefined);
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id/settings",
		permissions: [P.PROJECT_MANAGER.SETTINGS.UPDATE],
	})
	static async updateSettings(ctx: EndpointCtx<{ id: string }, { settings: ProjectSettings }>) {
		const settings = ctx.data?.settings;
		if (!settings || typeof settings !== "object") {
			throw new ProjectManagerError(400, "INVALID_FIELD", "`settings` debe ser un objeto");
		}
		return ProjectEndpoints.#service.projects.updateProject(ctx.params.id, { settings }, ctx.token ?? undefined);
	}
}
