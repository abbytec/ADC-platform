import type { Model } from "mongoose";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { applyProjectDefaults, validateKanbanColumns } from "../utils/defaults.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import { filterVisibleProjects } from "../utils/project-access.ts";

interface ListProjectsContext {
	userId: string;
	groupIds: string[];
	callerOrgId?: string;
	hasGlobalPMRead: boolean;
	isGlobalAdmin: boolean;
}

export class ProjectManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly projectModel: Model<Project>,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "ProjectManager", PM_RESOURCE_NAME);
	}

	async createProject(input: Partial<Project> & Pick<Project, "name" | "slug">, token?: string): Promise<Project> {
		const userId = await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, PMScopes.PROJECTS);

		const project = applyProjectDefaults({
			...input,
			id: generateId(),
			ownerId: input.ownerId ?? userId ?? "",
			orgId: input.orgId ?? null,
		});

		validateKanbanColumns(project.kanbanColumns);

		try {
			await this.projectModel.create(project);
		} catch (error: any) {
			if (error.code === 11000) {
				throw new ProjectManagerError(409, "SLUG_TAKEN", `El slug '${project.slug}' ya existe en este contexto`);
			}
			throw error;
		}

		this.logger.logDebug(`Proyecto creado: ${project.slug} (org=${project.orgId ?? "GLOBAL"})`);
		return project;
	}

	async getProject(projectId: string, token?: string): Promise<Project | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.PROJECTS);
		const doc = await this.projectModel.findOne({ id: projectId });
		return doc?.toObject?.() || doc || null;
	}

	async getProjectBySlug(slug: string, orgId: string | null, token?: string): Promise<Project | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.PROJECTS);
		const doc = await this.projectModel.findOne({ slug, orgId });
		return doc?.toObject?.() || doc || null;
	}

	/**
	 * Lista proyectos aplicando el filtro org-scoped/global del plan §3.6.
	 * Carga TODOS los que podrían ser visibles y luego filtra in-memory.
	 */
	async listVisibleProjects(ctx: ListProjectsContext, token?: string): Promise<Project[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.PROJECTS);

		const orConditions: Record<string, unknown>[] = [];
		if (ctx.isGlobalAdmin) {
			const docs = await this.projectModel.find({});
			return docs.map((d) => d.toObject?.() || d);
		}

		if (ctx.hasGlobalPMRead) orConditions.push({ orgId: null });
		if (ctx.callerOrgId) orConditions.push({ orgId: ctx.callerOrgId });

		// Membresía explícita (siempre consultar)
		orConditions.push({ memberUserIds: ctx.userId });
		orConditions.push({ ownerId: ctx.userId });
		if (ctx.groupIds.length) orConditions.push({ memberGroupIds: { $in: ctx.groupIds } });

		const docs = orConditions.length ? await this.projectModel.find({ $or: orConditions }) : [];
		const projects = docs.map((d) => d.toObject?.() || d);
		return filterVisibleProjects(projects, ctx);
	}

	async updateProject(projectId: string, updates: Partial<Project>, token?: string): Promise<Project> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.PROJECTS);

		if (updates.kanbanColumns) validateKanbanColumns(updates.kanbanColumns);

		const safeUpdates: Partial<Project> = { ...updates, updatedAt: new Date() };
		// Campos inmutables
		delete (safeUpdates as any).id;
		delete (safeUpdates as any).createdAt;
		delete (safeUpdates as any).issueCounter;

		const updated = await this.projectModel.findOneAndUpdate({ id: projectId }, safeUpdates, { new: true });
		if (!updated) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", `Proyecto ${projectId} no encontrado`);
		return updated.toObject?.() || updated;
	}

	async deleteProject(projectId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, PMScopes.PROJECTS);
		const result = await this.projectModel.deleteOne({ id: projectId });
		if (result.deletedCount === 0) {
			throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", `Proyecto ${projectId} no encontrado`);
		}
		this.logger.logDebug(`Proyecto eliminado: ${projectId}`);
	}

	/**
	 * Incrementa atómicamente el contador del proyecto y devuelve el nuevo número.
	 * Usado por IssueManager al crear issues para generar keys tipo `SLUG-123`.
	 */
	async incrementIssueCounter(projectId: string): Promise<number> {
		const updated = await this.projectModel.findOneAndUpdate({ id: projectId }, { $inc: { issueCounter: 1 } }, { new: true });
		if (!updated) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", `Proyecto ${projectId} no encontrado`);
		return (updated.toObject?.() || updated).issueCounter;
	}
}
