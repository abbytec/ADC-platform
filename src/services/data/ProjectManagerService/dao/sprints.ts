import type { Model } from "mongoose";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";

export class SprintManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly sprintModel: Model<Sprint>,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "SprintManager", PM_RESOURCE_NAME);
	}

	async create(projectId: string, input: Partial<Sprint> & Pick<Sprint, "name">, token?: string): Promise<Sprint> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, PMScopes.SPRINTS);

		const sprint: Sprint = {
			id: generateId(),
			projectId,
			name: input.name,
			goal: input.goal,
			startDate: input.startDate,
			endDate: input.endDate,
			status: input.status ?? "planned",
			createdAt: new Date(),
		};
		await this.sprintModel.create(sprint);
		return sprint;
	}

	async list(projectId: string, token?: string): Promise<Sprint[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.SPRINTS);
		const docs = await this.sprintModel.find({ projectId });
		return docs.map((d) => d.toObject?.() || d);
	}

	async get(sprintId: string, token?: string): Promise<Sprint | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.SPRINTS);
		const doc = await this.sprintModel.findOne({ id: sprintId });
		return doc?.toObject?.() || doc || null;
	}

	async update(sprintId: string, updates: Partial<Sprint>, token?: string): Promise<Sprint> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.SPRINTS);
		const safe: Partial<Sprint> = { ...updates };
		delete (safe as any).id;
		delete (safe as any).projectId;
		delete (safe as any).createdAt;
		const updated = await this.sprintModel.findOneAndUpdate({ id: sprintId }, safe, { new: true });
		if (!updated) throw new ProjectManagerError(404, "SPRINT_NOT_FOUND", `Sprint ${sprintId} no encontrado`);
		return updated.toObject?.() || updated;
	}

	async delete(sprintId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, PMScopes.SPRINTS);
		const result = await this.sprintModel.deleteOne({ id: sprintId });
		if (result.deletedCount === 0) throw new ProjectManagerError(404, "SPRINT_NOT_FOUND", `Sprint ${sprintId} no encontrado`);
	}

	async setStatus(sprintId: string, status: Sprint["status"], token?: string): Promise<Sprint> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.SPRINTS);
		const updates: Partial<Sprint> = { status };
		if (status === "completed") updates.completedAt = new Date();
		const updated = await this.sprintModel.findOneAndUpdate({ id: sprintId }, updates, { new: true });
		if (!updated) throw new ProjectManagerError(404, "SPRINT_NOT_FOUND", `Sprint ${sprintId} no encontrado`);
		this.logger.logDebug(`Sprint ${sprintId} → ${status}`);
		return updated.toObject?.() || updated;
	}
}
