import { createAdcApi } from "@ui-library/utils/adc-fetch";
import type { Project, KanbanColumn, ProjectSettings, PriorityStrategy } from "@common/types/project-manager/Project.ts";
import type { CustomFieldDef } from "@common/types/project-manager/CustomField.ts";
import type { IssueLinkType } from "@common/types/project-manager/IssueLink.ts";
import type { Sprint } from "@common/types/project-manager/Sprint.ts";
import type { Milestone } from "@common/types/project-manager/Milestone.ts";
import type { Issue } from "@common/types/project-manager/Issue.ts";
import type { UpdateLogEntry } from "@common/types/project-manager/UpdateLogEntry.ts";

const api = createAdcApi({
	basePath: "/api/pm",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

export interface IssueListParams {
	sprintId?: string;
	milestoneId?: string;
	assigneeId?: string;
	columnKey?: string;
	q?: string;
	orderBy?: "priority" | "createdAt" | "updatedAt";
	[key: string]: string | number | boolean | null | undefined;
}

export const pmApi = {
	// Projects
	listProjects: () => api.get<{ projects: Project[] }>("/projects"),
	checkProjectSlug: (orgSlug: string, projectSlug: string) =>
		api.get<{ available: boolean }>(`/projects/check-slug/${orgSlug}/${projectSlug}`),
	getProjectBySlug: (orgSlug: string, projectSlug: string) => api.get<Project>(`/projects/by-slug/${orgSlug}/${projectSlug}`),
	createProject: (data: {
		name: string;
		slug: string;
		description?: string;
		orgId?: string | null;
		ownerId?: string;
		visibility?: Project["visibility"];
		memberUserIds?: string[];
		memberGroupIds?: string[];
		kanbanColumns?: KanbanColumn[];
		settings?: Partial<ProjectSettings>;
	}) => api.post<Project>("/projects", { body: data, idempotencyData: data }),
	getProject: (id: string) => api.get<Project>(`/projects/${id}`),
	updateProject: (id: string, data: Partial<Project>) =>
		api.put<Project>(`/projects/${id}`, { body: data, idempotencyData: { projectId: id, data } }),
	deleteProject: (id: string) => api.delete(`/projects/${id}`, { idempotencyKey: id }),

	// Project settings (granulares — Fase 4)
	updateMembers: (id: string, memberUserIds: string[], memberGroupIds: string[]) =>
		api.put<Project>(`/projects/${id}/members`, {
			body: { memberUserIds, memberGroupIds },
			idempotencyData: { projectId: id, memberUserIds, memberGroupIds },
		}),
	updateColumns: (id: string, kanbanColumns: KanbanColumn[]) =>
		api.put<Project>(`/projects/${id}/columns`, {
			body: { kanbanColumns },
			idempotencyData: { projectId: id, kanbanColumns },
		}),
	updateCustomFields: (id: string, customFieldDefs: CustomFieldDef[]) =>
		api.put<Project>(`/projects/${id}/custom-fields`, {
			body: { customFieldDefs },
			idempotencyData: { projectId: id, customFieldDefs },
		}),
	updateLinkTypes: (id: string, issueLinkTypes: IssueLinkType[]) =>
		api.put<Project>(`/projects/${id}/link-types`, {
			body: { issueLinkTypes },
			idempotencyData: { projectId: id, issueLinkTypes },
		}),
	updatePriorityStrategy: (id: string, priorityStrategy: PriorityStrategy) =>
		api.put<Project>(`/projects/${id}/priority-strategy`, {
			body: { priorityStrategy },
			idempotencyData: { projectId: id, priorityStrategy },
		}),
	updateSettings: (id: string, settings: ProjectSettings) =>
		api.put<Project>(`/projects/${id}/settings`, { body: { settings }, idempotencyData: { projectId: id, settings } }),

	// Sprints
	listSprints: (projectId: string) => api.get<{ sprints: Sprint[] }>(`/projects/${projectId}/sprints`),
	createSprint: (projectId: string, data: Partial<Sprint> & { name: string }) =>
		api.post<Sprint>(`/projects/${projectId}/sprints`, { body: data, idempotencyData: { projectId, ...data } }),
	updateSprint: (id: string, data: Partial<Sprint>) =>
		api.put<Sprint>(`/sprints/${id}`, { body: data, idempotencyData: { sprintId: id, data } }),
	deleteSprint: (id: string) => api.delete(`/sprints/${id}`, { idempotencyKey: id }),
	startSprint: (id: string) => api.post<Sprint>(`/sprints/${id}/start`, { idempotencyKey: `start:${id}` }),
	completeSprint: (id: string) => api.post<Sprint>(`/sprints/${id}/complete`, { idempotencyKey: `complete:${id}` }),

	// Milestones
	listMilestones: (projectId: string) => api.get<{ milestones: Milestone[] }>(`/projects/${projectId}/milestones`),
	createMilestone: (projectId: string, data: Partial<Milestone> & { name: string }) =>
		api.post<Milestone>(`/projects/${projectId}/milestones`, { body: data, idempotencyData: { projectId, ...data } }),
	updateMilestone: (id: string, data: Partial<Milestone>) =>
		api.put<Milestone>(`/milestones/${id}`, { body: data, idempotencyData: { milestoneId: id, data } }),
	deleteMilestone: (id: string) => api.delete(`/milestones/${id}`, { idempotencyKey: id }),

	// Issues
	listIssues: (projectId: string, params?: IssueListParams) =>
		api.get<{ issues: Issue[]; project: Project }>(`/projects/${projectId}/issues`, params ? { params } : undefined),
	createIssue: (projectId: string, data: Partial<Issue> & { title: string }) =>
		api.post<Issue>(`/projects/${projectId}/issues`, { body: data, idempotencyData: { projectId, ...data } }),
	getIssue: (id: string) => api.get<Issue>(`/issues/${id}`),
	updateIssue: (id: string, data: Partial<Issue> & { reason?: string }) =>
		api.put<Issue>(`/issues/${id}`, { body: data, idempotencyData: { issueId: id, data } }),
	deleteIssue: (id: string) => api.delete(`/issues/${id}`, { idempotencyKey: id }),
	moveIssue: (id: string, columnKey: string, reason?: string) =>
		api.post<Issue>(`/issues/${id}/move`, { body: { columnKey, reason }, idempotencyData: { issueId: id, columnKey, reason } }),
	getIssueHistory: (id: string) => api.get<{ updateLog: UpdateLogEntry[] }>(`/issues/${id}/history`),
};
