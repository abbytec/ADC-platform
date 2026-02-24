export { IdentityScope as Scope } from "@common/types/identity.js";
export { CRUDXAction as Action } from "@common/types/Actions";

import { IdentityScope } from "@common/types/identity.js";
import { CRUDXAction } from "@common/types/Actions";
import type { IdentityScope as IdentityScopeFromApi } from "./identity-api.ts";

/**
 * Tab definition for the identity management panel
 */
export interface IdentityTab {
	id: string;
	label: string;
	requiredScope: number;
	requiredAction: number;
}

/**
 * Available tabs with their required permissions
 */
export const IDENTITY_TABS: IdentityTab[] = [
	{ id: "users", label: "users", requiredScope: IdentityScope.USERS, requiredAction: CRUDXAction.READ },
	{ id: "roles", label: "roles", requiredScope: IdentityScope.ROLES, requiredAction: CRUDXAction.READ },
	{ id: "groups", label: "groups", requiredScope: IdentityScope.GROUPS, requiredAction: CRUDXAction.READ },
	{ id: "organizations", label: "organizations", requiredScope: IdentityScope.ORGANIZATIONS, requiredAction: CRUDXAction.READ },
	{ id: "regions", label: "regions", requiredScope: IdentityScope.REGIONS, requiredAction: CRUDXAction.READ },
];

/**
 * Checks if the user's resolved scopes grant a specific permission
 */
export function hasPermission(scopes: IdentityScopeFromApi[], requiredAction: number, requiredScope: number): boolean {
	return scopes.some((s) => (s.action & requiredAction) === requiredAction && (s.scope & requiredScope) === requiredScope);
}

/**
 * Filters tabs based on user's permissions.
 * When orgId is set (org mode), organizations and regions tabs are hidden.
 */
export function getVisibleTabs(scopes: IdentityScopeFromApi[], orgId?: string): IdentityTab[] {
	return IDENTITY_TABS.filter((tab) => {
		if (orgId && (tab.id === "organizations" || tab.id === "regions")) return false;
		return hasPermission(scopes, tab.requiredAction, tab.requiredScope);
	});
}

/**
 * Checks if user can perform a specific action on a scope
 */
export function canWrite(scopes: IdentityScopeFromApi[], scope: number): boolean {
	return hasPermission(scopes, CRUDXAction.WRITE, scope);
}

export function canUpdate(scopes: IdentityScopeFromApi[], scope: number): boolean {
	return hasPermission(scopes, CRUDXAction.UPDATE, scope);
}

export function canDelete(scopes: IdentityScopeFromApi[], scope: number): boolean {
	return hasPermission(scopes, CRUDXAction.DELETE, scope);
}
