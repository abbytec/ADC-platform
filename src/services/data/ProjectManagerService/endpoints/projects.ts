import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { P } from "@common/types/Permissions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import type ProjectManagerService from "../index.js";
import type { Project } from "@common/types/project-manager/Project.ts";

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
	static init(service: ProjectManagerService): void {
		ProjectEndpoints.#service ??= service;
	}

	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects",
		permissions: [P.PROJECT_MANAGER.PROJECTS.READ],
	})
	static async list(ctx: EndpointCtx) {
		const service = ProjectEndpoints.#service;
		const projects = await service.listProjectsForCaller(ctx);
		return { projects };
	}

	/**
	 * Comprueba disponibilidad de un slug de proyecto dentro de un contexto org.
	 * `orgSlug` = "default" para proyectos globales.
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/check-slug/:orgSlug/:projectSlug",
		permissions: [P.PROJECT_MANAGER.PROJECTS.READ],
	})
	static async checkSlug(ctx: EndpointCtx<{ orgSlug: string; projectSlug: string }>) {
		const service = ProjectEndpoints.#service;
		const projectSlug = ctx.params.projectSlug.toLowerCase().trim();
		if (!/^[a-z0-9-]+$/.test(projectSlug)) {
			return { available: false };
		}
		const orgId = await resolveOrgSlug(service, ctx.params.orgSlug, ctx.token ?? undefined);
		const existing = await service.projects.getProjectBySlug(projectSlug, orgId, ctx.token ?? undefined);
		return { available: !existing };
	}

	/** Lookup de proyecto por slug dentro de un contexto org ("default" = global). */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/pm/projects/by-slug/:orgSlug/:projectSlug",
		permissions: [P.PROJECT_MANAGER.PROJECTS.READ],
	})
	static async getBySlug(ctx: EndpointCtx<{ orgSlug: string; projectSlug: string }>) {
		const service = ProjectEndpoints.#service;
		const orgId = await resolveOrgSlug(service, ctx.params.orgSlug, ctx.token ?? undefined);
		const project = await service.projects.getProjectBySlug(ctx.params.projectSlug.toLowerCase(), orgId, ctx.token ?? undefined);
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
		permissions: [P.PROJECT_MANAGER.PROJECTS.READ],
	})
	static async get(ctx: EndpointCtx<{ id: string }>) {
		const project = await ProjectEndpoints.#service.projects.getProject(ctx.params.id, ctx.token ?? undefined);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", "Proyecto no encontrado");
		return project;
	}

	@RegisterEndpoint({
		method: "PUT",
		url: "/api/pm/projects/:id",
		permissions: [P.PROJECT_MANAGER.PROJECTS.UPDATE],
	})
	static async update(ctx: EndpointCtx<{ id: string }, Partial<Project>>) {
		return ProjectEndpoints.#service.projects.updateProject(ctx.params.id, ctx.data ?? {}, ctx.token ?? undefined);
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
}
