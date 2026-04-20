import type { Model } from "mongoose";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";

export class MilestoneManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly milestoneModel: Model<Milestone>,
		_logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "MilestoneManager", PM_RESOURCE_NAME);
	}

	async create(projectId: string, input: Partial<Milestone> & Pick<Milestone, "name">, token?: string): Promise<Milestone> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, PMScopes.MILESTONES);
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
		return milestone;
	}

	async list(projectId: string, token?: string): Promise<Milestone[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.MILESTONES);
		const docs = await this.milestoneModel.find({ projectId });
		return docs.map((d) => d.toObject?.() || d);
	}

	async get(milestoneId: string, token?: string): Promise<Milestone | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.MILESTONES);
		const doc = await this.milestoneModel.findOne({ id: milestoneId });
		return doc?.toObject?.() || doc || null;
	}

	async update(milestoneId: string, updates: Partial<Milestone>, token?: string): Promise<Milestone> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.MILESTONES);
		const safe: Partial<Milestone> = { ...updates };
		delete (safe as any).id;
		delete (safe as any).projectId;
		delete (safe as any).createdAt;
		const updated = await this.milestoneModel.findOneAndUpdate({ id: milestoneId }, safe, { new: true });
		if (!updated) throw new ProjectManagerError(404, "MILESTONE_NOT_FOUND", `Milestone ${milestoneId} no encontrado`);
		return updated.toObject?.() || updated;
	}

	async delete(milestoneId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, PMScopes.MILESTONES);
		const result = await this.milestoneModel.deleteOne({ id: milestoneId });
		if (result.deletedCount === 0) throw new ProjectManagerError(404, "MILESTONE_NOT_FOUND", `Milestone ${milestoneId} no encontrado`);
	}
}
