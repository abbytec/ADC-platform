import { IdentityScope as Scope, Action } from "@common/types/identity.js";
import type { IdentityScope as IdentityScopeFromApi } from "./identity-api.ts";

export { Scope, Action };

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
	{ id: "users", label: "users", requiredScope: Scope.USERS, requiredAction: Action.READ },
	{ id: "roles", label: "roles", requiredScope: Scope.ROLES, requiredAction: Action.READ },
	{ id: "groups", label: "groups", requiredScope: Scope.GROUPS, requiredAction: Action.READ },
	{ id: "organizations", label: "organizations", requiredScope: Scope.ORGANIZATIONS, requiredAction: Action.READ },
	{ id: "regions", label: "regions", requiredScope: Scope.REGIONS, requiredAction: Action.READ },
];

/**
 * Checks if the user's resolved scopes grant a specific permission
 */
export function hasPermission(scopes: IdentityScopeFromApi[], requiredAction: number, requiredScope: number): boolean {
	return scopes.some((s) => (s.action & requiredAction) === requiredAction && (s.scope & requiredScope) === requiredScope);
}

/**
 * Filters tabs based on user's permissions
 */
export function getVisibleTabs(scopes: IdentityScopeFromApi[]): IdentityTab[] {
	return IDENTITY_TABS.filter((tab) => hasPermission(scopes, tab.requiredAction, tab.requiredScope));
}

/**
 * Checks if user can perform a specific action on a scope
 */
export function canWrite(scopes: IdentityScopeFromApi[], scope: number): boolean {
	return hasPermission(scopes, Action.WRITE, scope);
}

export function canUpdate(scopes: IdentityScopeFromApi[], scope: number): boolean {
	return hasPermission(scopes, Action.UPDATE, scope);
}

export function canDelete(scopes: IdentityScopeFromApi[], scope: number): boolean {
	return hasPermission(scopes, Action.DELETE, scope);
}
