export { PMScopes as Scope } from "@common/types/project-manager/permissions.ts";
export { CRUDXAction as Action } from "@common/types/Actions";

import { PMScopes } from "@common/types/project-manager/permissions.ts";
import { CRUDXAction } from "@common/types/Actions";
import type { Permission } from "@common/types/identity/Permission.ts";

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

export function hasPermission(scopes: Permission[], requiredAction: number, requiredScope: number): boolean {
	return scopes.some((s) => (s.action & requiredAction) === requiredAction && (s.scope & requiredScope) === requiredScope);
}

/** Verifica acceso básico a proyectos */
export function canAccessProjects(scopes: Permission[]): boolean {
	return hasPermission(scopes, CRUDXAction.READ, PMScopes.PROJECTS);
}

export function getVisibleProjectTabs(scopes: Permission[]): PMTab[] {
	return PROJECT_TABS.filter((tab) => hasPermission(scopes, tab.requiredAction, tab.requiredScope));
}

export function canWrite(scopes: Permission[], scope: number): boolean {
	return hasPermission(scopes, CRUDXAction.WRITE, scope);
}
export function canUpdate(scopes: Permission[], scope: number): boolean {
	return hasPermission(scopes, CRUDXAction.UPDATE, scope);
}
export function canDelete(scopes: Permission[], scope: number): boolean {
	return hasPermission(scopes, CRUDXAction.DELETE, scope);
}
