import type { Model } from "mongoose";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { applyProjectDefaults, validateKanbanColumns } from "../utils/defaults.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import { OnlyKernel } from "../../../../utils/decorators/OnlyKernel.ts";
import { filterVisibleProjects, isProjectMember } from "../utils/project-access.ts";

interface ListProjectsContext {
	userId: string;
	groupIds: string[];
	callerOrgId?: string;
	hasGlobalPMRead: boolean;
	isGlobalAdmin: boolean;
}

/** Contexto del caller para evaluar acceso alternativo por membresía. */
export interface CallerMembership {
	userId: string;
	groupIds: string[];
}

/**
 * Accesores internos para otros DAOs del mismo service. No consumirlos desde
 * endpoints: las operaciones aquí expuestas no pasan por `requirePermission`.
 */
export interface ProjectInternals {
	fetchProject: (projectId: string) => Promise<Project | null>;
	incrementIssueCounter: (projectId: string) => Promise<number>;
}

export class ProjectManager {
	#permissionChecker: PermissionChecker;
	/** Usado por `@OnlyKernel()` para verificar el caller. */
	protected readonly kernelKey: symbol;

	constructor(
		private readonly projectModel: Model<Project>,
		kernelKey: symbol,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.kernelKey = kernelKey;
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

	async #fetchProject(projectId: string): Promise<Project | null> {
		const doc = await this.projectModel.findOne({ id: projectId });
		return doc?.toObject?.() || doc || null;
	}

	async #fetchProjectBySlug(slug: string, orgId: string | null): Promise<Project | null> {
		const doc = await this.projectModel.findOne({ slug, orgId });
		return doc?.toObject?.() || doc || null;
	}

	async getProject(projectId: string, token?: string, caller?: CallerMembership): Promise<Project | null> {
		const project = await this.#fetchProject(projectId);
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.PROJECTS, {
			ownerId: project?.ownerId,
			allowIf: (uid) => isProjectMember(project, { id: uid, groupIds: caller?.groupIds ?? [] }),
		});
		return project;
	}

	async getProjectBySlug(slug: string, orgId: string | null, token?: string, caller?: CallerMembership): Promise<Project | null> {
		const project = await this.#fetchProjectBySlug(slug, orgId);
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.PROJECTS, {
			ownerId: project?.ownerId,
			allowIf: (uid) => isProjectMember(project, { id: uid, groupIds: caller?.groupIds ?? [] }),
		});
		return project;
	}

	/** Comprobación pública de existencia de slug (no expone el proyecto). */
	async isSlugAvailable(slug: string, orgId: string | null, token?: string): Promise<boolean> {
		await this.#permissionChecker.resolveUserId(token);
		const existing = await this.#fetchProjectBySlug(slug, orgId);
		return !existing;
	}

	async listVisibleProjects(ctx: ListProjectsContext, token?: string): Promise<Project[]> {
		await this.#permissionChecker.resolveUserId(token);

		if (ctx.isGlobalAdmin) {
			const docs = await this.projectModel.find({});
			return docs.map((d) => d.toObject?.() || d);
		}

		const orConditions: Record<string, unknown>[] = [];
		if (ctx.hasGlobalPMRead) orConditions.push({ orgId: null });
		if (ctx.callerOrgId) orConditions.push({ orgId: ctx.callerOrgId });
		orConditions.push({ memberUserIds: ctx.userId });
		orConditions.push({ ownerId: ctx.userId });
		if (ctx.groupIds.length) orConditions.push({ memberGroupIds: { $in: ctx.groupIds } });

		const docs = orConditions.length ? await this.projectModel.find({ $or: orConditions }) : [];
		const projects = docs.map((d) => d.toObject?.() || d);
		return filterVisibleProjects(projects, ctx);
	}

	async updateProject(projectId: string, updates: Partial<Project>, token?: string, caller?: CallerMembership): Promise<Project> {
		const project = await this.#fetchProject(projectId);
		if (!project) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", `Proyecto ${projectId} no encontrado`);

		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.PROJECTS, {
			ownerId: project.ownerId,
			allowIf: (uid) =>
				project.ownerId === uid || (caller?.userId === uid && isProjectMember(project, { id: uid, groupIds: caller.groupIds })),
		});

		if (updates.kanbanColumns) validateKanbanColumns(updates.kanbanColumns);

		const safeUpdates: Partial<Project> = { ...updates, updatedAt: new Date() };
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

	async #incrementIssueCounter(projectId: string): Promise<number> {
		const updated = await this.projectModel.findOneAndUpdate({ id: projectId }, { $inc: { issueCounter: 1 } }, { new: true });
		if (!updated) throw new ProjectManagerError(404, "PROJECT_NOT_FOUND", `Proyecto ${projectId} no encontrado`);
		return (updated.toObject?.() || updated).issueCounter;
	}

	/**
	 * Devuelve accesores sin autorización para uso exclusivo de otros DAOs del
	 * mismo service. Protegido por `kernelKey`: sólo el service que creó este
	 * manager puede obtenerlos.
	 */
	@OnlyKernel()
	getInternals(_kernelKey: symbol): ProjectInternals {
		return {
			fetchProject: (id) => this.#fetchProject(id),
			incrementIssueCounter: (id) => this.#incrementIssueCounter(id),
		};
	}
}
