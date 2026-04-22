export { PMScopes as Scope } from "@common/types/project-manager/permissions.ts";
export { CRUDXAction as Action } from "@common/types/Actions";

import { PMScopes } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions";
import type { Permission } from "@common/types/identity/Permission.ts";
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

/** Verifica acceso básico a proyectos */
export function canAccessProjects(perms: Permission[]): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.READ, PMScopes.PROJECTS);
}

export function getVisibleProjectTabs(perms: Permission[]): PMTab[] {
	return PROJECT_TABS.filter((tab) => hasPermission(perms, RESOURCE, tab.requiredAction, tab.requiredScope));
}

export function canWrite(perms: Permission[], scope: number): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.WRITE, scope);
}
export function canUpdate(perms: Permission[], scope: number): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.UPDATE, scope);
}
export function canDelete(perms: Permission[], scope: number): boolean {
	return hasPermission(perms, RESOURCE, CRUDXAction.DELETE, scope);
}
