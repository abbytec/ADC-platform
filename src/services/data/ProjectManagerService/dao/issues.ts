import type { Model } from "mongoose";
import type { Issue, IssuePriority } from "@common/types/project-manager/Issue.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { ProjectManagerError } from "@common/types/custom-errors/ProjectManagerError.ts";
import { formatIssueKey, deriveProjectKey } from "@common/utils/project-manager/keygen.ts";
import { buildDiffEntries } from "@common/utils/project-manager/diff.ts";
import { sortIssuesByPriority, normalizeUrgency, normalizeDifficulty } from "@common/utils/project-manager/priority.ts";
import type { ProjectManager } from "./projects.ts";

export interface IssueListFilters {
	sprintId?: string;
	milestoneId?: string;
	assigneeId?: string;
	columnKey?: string;
	q?: string;
	orderBy?: "priority" | "createdAt" | "updatedAt";
}

function defaultPriority(): IssuePriority {
	return { urgency: 0, importance: 0, difficulty: null };
}

export class IssueManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly issueModel: Model<Issue>,
		private readonly projectManager: ProjectManager,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "IssueManager", PM_RESOURCE_NAME);
	}

	async create(project: Project, input: Partial<Issue> & Pick<Issue, "title">, token?: string): Promise<Issue> {
		const reporterId = await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, PMScopes.ISSUES);

		// Determinar columna inicial (isAuto)
		const autoColumn = project.kanbanColumns.find((c) => c.isAuto) ?? project.kanbanColumns[0];
		if (!autoColumn) {
			throw new ProjectManagerError(500, "INVALID_COLUMN", "Proyecto sin columna inicial configurada");
		}

		// Generar key atómicamente
		const number = await this.projectManager.incrementIssueCounter(project.id);
		const prefix = deriveProjectKey(project.slug || project.name);
		const key = formatIssueKey(prefix, number);

		const priority: IssuePriority = input.priority
			? {
					urgency: normalizeUrgency(input.priority.urgency),
					importance: normalizeUrgency(input.priority.importance),
					difficulty: normalizeDifficulty(input.priority.difficulty),
				}
			: defaultPriority();

		const issue: Issue = {
			id: generateId(),
			projectId: project.id,
			key,
			title: input.title,
			description: input.description ?? "",
			columnKey: input.columnKey ?? autoColumn.key,
			category: input.category ?? "task",
			sprintId: input.sprintId,
			milestoneId: input.milestoneId,
			reporterId: reporterId || input.reporterId || "",
			assigneeIds: input.assigneeIds ?? [],
			assigneeGroupIds: input.assigneeGroupIds ?? [],
			priority,
			storyPoints: input.storyPoints,
			customFields: input.customFields ?? {},
			linkedIssues: input.linkedIssues ?? [],
			attachments: [],
			updateLog: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await this.issueModel.create(issue);
		this.logger.logDebug(`Issue ${key} creado en ${project.slug}`);
		return issue;
	}

	async get(issueId: string, token?: string): Promise<Issue | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.ISSUES);
		const doc = await this.issueModel.findOne({ id: issueId });
		return doc?.toObject?.() || doc || null;
	}

	async list(project: Project, filters: IssueListFilters = {}, token?: string): Promise<Issue[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, PMScopes.ISSUES);

		const query: Record<string, unknown> = { projectId: project.id };
		if (filters.sprintId) query.sprintId = filters.sprintId;
		if (filters.milestoneId) query.milestoneId = filters.milestoneId;
		if (filters.columnKey) query.columnKey = filters.columnKey;
		if (filters.assigneeId) query.assigneeIds = filters.assigneeId;
		if (filters.q) query.$text = { $search: filters.q };

		const docs = await this.issueModel.find(query);
		const issues = docs.map((d) => d.toObject?.() || d);

		if (filters.orderBy === "priority") return sortIssuesByPriority(issues, project.priorityStrategy);
		if (filters.orderBy === "createdAt") return issues.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		if (filters.orderBy === "updatedAt") return issues.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
		return issues;
	}

	async update(issueId: string, updates: Partial<Issue>, reason: string | undefined, token?: string): Promise<Issue> {
		const actorId = await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.ISSUES);

		const currentDoc = await this.issueModel.findOne({ id: issueId });
		if (!currentDoc) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", `Issue ${issueId} no encontrado`);
		const current: Issue = currentDoc.toObject?.() || currentDoc;

		// Normalizar prioridad si viene
		if (updates.priority) {
			updates.priority = {
				urgency: normalizeUrgency(updates.priority.urgency),
				importance: normalizeUrgency(updates.priority.importance),
				difficulty: normalizeDifficulty(updates.priority.difficulty),
			};
		}

		// Inmutables
		const safe: Partial<Issue> = { ...updates, updatedAt: new Date() };
		delete (safe as any).id;
		delete (safe as any).projectId;
		delete (safe as any).key;
		delete (safe as any).createdAt;
		delete (safe as any).reporterId;
		delete (safe as any).updateLog;
		delete (safe as any).attachments;

		const diffEntries = buildDiffEntries(current, safe, actorId || current.reporterId, reason);

		const setOps: Record<string, unknown> = { ...safe };
		const updateDoc: Record<string, unknown> = { $set: setOps };
		if (diffEntries.length) updateDoc.$push = { updateLog: { $each: diffEntries } };

		const updated = await this.issueModel.findOneAndUpdate({ id: issueId }, updateDoc, { new: true });
		if (!updated) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", `Issue ${issueId} no encontrado`);
		return updated.toObject?.() || updated;
	}

	async delete(issueId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, PMScopes.ISSUES);
		const result = await this.issueModel.deleteOne({ id: issueId });
		if (result.deletedCount === 0) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", `Issue ${issueId} no encontrado`);
	}

	/**
	 * Mueve un issue a otra columna. Valida WIP limits y marca `closedAt` cuando
	 * la columna destino es `isDone`.
	 */
	async move(project: Project, issueId: string, targetColumnKey: string, reason: string | undefined, token?: string): Promise<Issue> {
		const actorId = await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, PMScopes.ISSUES);

		const column = project.kanbanColumns.find((c) => c.key === targetColumnKey);
		if (!column) throw new ProjectManagerError(400, "COLUMN_NOT_FOUND", `Columna '${targetColumnKey}' no existe en el proyecto`);

		// WIP limit check
		const wipLimit = project.settings?.wipLimits?.[targetColumnKey];
		if (wipLimit !== undefined) {
			const count = await this.issueModel.countDocuments({ projectId: project.id, columnKey: targetColumnKey });
			if (count >= wipLimit) {
				throw new ProjectManagerError(400, "WIP_LIMIT_REACHED", `Columna '${targetColumnKey}' alcanzó su WIP limit (${wipLimit})`);
			}
		}

		const currentDoc = await this.issueModel.findOne({ id: issueId });
		if (!currentDoc) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", `Issue ${issueId} no encontrado`);
		const current: Issue = currentDoc.toObject?.() || currentDoc;

		if (current.columnKey === targetColumnKey) return current;

		const patch: Partial<Issue> = { columnKey: targetColumnKey, updatedAt: new Date() };
		if (column.isDone) patch.closedAt = new Date();
		else if (current.closedAt) patch.closedAt = undefined;

		const diff = buildDiffEntries(current, patch, actorId || current.reporterId, reason);

		const updated = await this.issueModel.findOneAndUpdate(
			{ id: issueId },
			{ $set: patch, $push: { updateLog: { $each: diff } } },
			{ new: true }
		);
		if (!updated) throw new ProjectManagerError(404, "ISSUE_NOT_FOUND", `Issue ${issueId} no encontrado`);
		return updated.toObject?.() || updated;
	}
}
