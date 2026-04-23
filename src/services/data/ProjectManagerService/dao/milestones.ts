import type { Model } from "mongoose";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import { getPMTierLimits } from "@common/types/project-manager/tier-limits.ts";
import type { CallerMembership, ProjectInternals } from "./projects.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import {
	docToPlain,
	fetchEntityWithProject,
	projectMemberAllowIf,
	projectOwnerAllowIf,
	requireProject,
	stripImmutableFields,
} from "./shared.ts";

const MILESTONE_IMMUTABLE_FIELDS = ["id", "projectId", "createdAt"] as const;

export class MilestoneManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly milestoneModel: Model<Milestone>,
		private readonly projectInternals: ProjectInternals,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "MilestoneManager", PM_RESOURCE_NAME);
	}

	#projectMemberAllowIf(project: Project | null, caller?: CallerMembership) {
		return projectMemberAllowIf(project, caller);
	}

	async #requireProject(projectId: string): Promise<Project> {
		return requireProject(this.projectInternals, projectId);
	}

	async #fetchMilestoneAndProject(milestoneId: string): Promise<{ milestone: Milestone | null; project: Project | null }> {
		const { entity, project } = await fetchEntityWithProject<Milestone>(this.milestoneModel, milestoneId, this.projectInternals);
		return { milestone: entity, project };
	}

	async create(
		projectId: string,
		input: Partial<Milestone> & Pick<Milestone, "name">,
		token?: string,
		_caller?: CallerMembership
	): Promise<Milestone> {
		const project = await this.#requireProject(projectId);
		await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, PMScopes.MILESTONES, {
			ownerId: project.ownerId,
			allowIf: projectOwnerAllowIf(project),
		});

		const { maxMilestonesPerProject } = getPMTierLimits();
		const count = await this.milestoneModel.countDocuments({ projectId });
		if (count >= maxMilestonesPerProject) {
			throw new ProjectManagerError(403, "TIER_LIMIT_REACHED", `Límite de milestones por proyecto alcanzado (${maxMilestonesPerProject})`);
		}

		const milestone: Milestone = {
			id: generateId(),
			projectId,
			name: input.name,
			description: input.description,
			startDate: input.startDate,
			endDate: input.endDate,
			status: input.status ?? "planned",
			createdAt: new Date(),
		};
		await this.milestoneModel.create(milestone);
		this.logger.logDebug(`Milestone ${milestone.name} creado en proyecto ${projectId}`);
		return milestone;
	}

	async list(projectId: string, token?: string, caller?: CallerMembership): Promise<Milestone[]> {
		const project = await this.#requireProject(projectId);
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.MILESTONES, {
			ownerId: project.ownerId,
			allowIf: this.#projectMemberAllowIf(project, caller),
		});
		const docs = await this.milestoneModel.find({ projectId });
		return docs.map((d) => docToPlain<Milestone>(d)!);
	}

	async get(milestoneId: string, token?: string, caller?: CallerMembership): Promise<Milestone | null> {
		const { milestone, project } = await this.#fetchMilestoneAndProject(milestoneId);
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.MILESTONES, {
			ownerId: project?.ownerId,
			allowIf: this.#projectMemberAllowIf(project, caller),
		});
		return milestone;
	}

	async update(milestoneId: string, updates: Partial<Milestone>, token?: string, _caller?: CallerMembership): Promise<Milestone> {
		const { milestone, project } = await this.#fetchMilestoneAndProject(milestoneId);
		if (!milestone) throw new ProjectManagerError(404, "MILESTONE_NOT_FOUND", `Milestone ${milestoneId} no encontrado`);
		// Update sobre milestones: rol PM / permiso formal, o owner del proyecto.
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.MILESTONES, {
			ownerId: project?.ownerId,
			allowIf: projectOwnerAllowIf(project),
		});
		const safe = stripImmutableFields(updates, MILESTONE_IMMUTABLE_FIELDS);
		const updated = await this.milestoneModel.findOneAndUpdate({ id: milestoneId }, safe, { new: true });
		if (!updated) throw new ProjectManagerError(404, "MILESTONE_NOT_FOUND", `Milestone ${milestoneId} no encontrado`);
		return docToPlain<Milestone>(updated)!;
	}

	async delete(milestoneId: string, token?: string, _caller?: CallerMembership): Promise<void> {
		const { milestone, project } = await this.#fetchMilestoneAndProject(milestoneId);
		// Auth-first: no revelamos existencia ante usuarios no autorizados.
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, PMScopes.MILESTONES, {
			ownerId: project?.ownerId,
			// Delete es más restrictivo: sólo owner del proyecto (o permiso global).
			allowIf: projectOwnerAllowIf(project),
		});
		if (!milestone) throw new ProjectManagerError(404, "MILESTONE_NOT_FOUND", `Milestone ${milestoneId} no encontrado`);
		const result = await this.milestoneModel.deleteOne({ id: milestoneId });
		if (result.deletedCount === 0) throw new ProjectManagerError(404, "MILESTONE_NOT_FOUND", `Milestone ${milestoneId} no encontrado`);
		this.logger.logDebug(`Milestone ${milestoneId} eliminado`);
	}
}
