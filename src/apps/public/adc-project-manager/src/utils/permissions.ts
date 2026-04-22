export { PMScopes as Scope } from "@common/types/project-manager/permissions.ts";
export { CRUDXAction as Action } from "@common/types/Actions";

import { PMScopes } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import type { Issue } from "@common/types/project-manager/Issue.ts";
import { hasPermission } from "@common/utils/perms.ts";

export interface PMTab {
	id: string;
	label: string;
	requiredScope: number;
	requiredAction: number;
}

/** Tabs dentro de un proyecto */
export const PROJECT_TABS: PMTab[] = [
	{ id: "board", label: "board", requiredScope: PMScopes.ISSUES, requiredAction: CRUDXAction.READ },
	{ id: "issues", label: "issues", requiredScope: PMScopes.ISSUES, requiredAction: CRUDXAction.READ },
	{ id: "calendar", label: "calendar", requiredScope: PMScopes.ISSUES, requiredAction: CRUDXAction.READ },
	{ id: "sprints", label: "sprints", requiredScope: PMScopes.SPRINTS, requiredAction: CRUDXAction.READ },
	{ id: "milestones", label: "milestones", requiredScope: PMScopes.MILESTONES, requiredAction: CRUDXAction.READ },
	{ id: "settings", label: "settings", requiredScope: PMScopes.SETTINGS, requiredAction: CRUDXAction.READ },
];

const RESOURCE = "project-manager";

export interface CallerCtx {
	userId?: string;
	groupIds?: string[];
}

/** Devuelve `true` si el caller es owner, miembro o pertenece a un group miembro del proyecto. */
export function isProjectMember(project: Project | null | undefined, caller: CallerCtx | null | undefined): boolean {
	if (!project || !caller?.userId) return false;
	if (project.ownerId === caller.userId) return true;
	if (project.memberUserIds?.includes(caller.userId)) return true;
	const gids = caller.groupIds ?? [];
	return project.memberGroupIds?.some((gid) => gids.includes(gid)) ?? false;
}

/** Devuelve `true` si el caller es asignado al issue (directo o vía group). */
export function isIssueAssignee(issue: Issue | null | undefined, caller: CallerCtx | null | undefined): boolean {
	if (!issue || !caller?.userId) return false;
	if (issue.assigneeIds?.includes(caller.userId)) return true;
	const gids = caller.groupIds ?? [];
	return issue.assigneeGroupIds?.some((gid) => gids.includes(gid)) ?? false;
}

/** Verifica acceso básico a proyectos (permiso formal). */
export function canAccessProjects(perms: Permission[]): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.READ, PMScopes.PROJECTS);
}

/** Visibilidad del tablero: permiso formal O miembro del proyecto. */
export function canViewProject(perms: Permission[], project: Project | null, caller?: CallerCtx): boolean {
	if (hasPermission(perms, RESOURCE, CRUDXAction.READ, PMScopes.PROJECTS, { selfId: caller?.userId, ownerId: project?.ownerId })) return true;
	return isProjectMember(project, caller);
}

export function getVisibleProjectTabs(perms: Permission[], project?: Project | null, caller?: CallerCtx): PMTab[] {
	const isMember = isProjectMember(project, caller);
	return PROJECT_TABS.filter((tab) => {
		// Miembros ven todos los tabs de contenido (board/issues/calendar/sprints/milestones).
		// `settings` se mantiene gated por permiso formal para evitar que cualquier miembro edite.
		if (isMember && tab.id !== "settings") return true;
		return hasPermission(perms, RESOURCE, tab.requiredAction, tab.requiredScope, {
			selfId: caller?.userId,
			ownerId: project?.ownerId,
		});
	});
}

export function canWrite(perms: Permission[], scope: number, opts?: { ownerId?: string; selfId?: string }): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.WRITE, scope, opts);
}
export function canUpdate(perms: Permission[], scope: number, opts?: { ownerId?: string; selfId?: string }): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.UPDATE, scope, opts);
}
export function canDelete(perms: Permission[], scope: number, opts?: { ownerId?: string; selfId?: string }): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.DELETE, scope, opts);
}

/**
 * Un issue puede ser actualizado si el usuario tiene permiso formal UPDATE o si
 * es asignado al issue. (Los logs son inmutables por contrato del backend.)
 */
export function canUpdateIssue(perms: Permission[], project: Project | null, issue: Issue | null, caller?: CallerCtx): boolean {
	if (isIssueAssignee(issue, caller)) return true;
	return canUpdate(perms, PMScopes.ISSUES, { selfId: caller?.userId, ownerId: issue?.reporterId ?? project?.ownerId });
}
