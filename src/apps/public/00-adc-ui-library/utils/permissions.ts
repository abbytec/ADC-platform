/**
 * Helper de permisos para frontends.
 * Replica la lógica bitfield del backend (validator.ts).
 */

import { CRUDXAction } from "@common/types/Actions.js";
import { COMMUNITY_SCOPES_MAP } from "@common/types/resources.js";

export type CRUDXActionValue = (typeof CRUDXAction)[keyof typeof CRUDXAction];

/**
 * Verifica si el listado de permisos del usuario satisface la combinación bitfield
 * `resource.scope.action`. Soporta wildcards `*` y `resource.scope.*`.
 */
export function hasAnyPermission(userPermissions: readonly string[], resource: string, scope: number, action: number): boolean {
	if (!userPermissions.length) return false;
	if (userPermissions.includes("*")) return true;

	const exact = `${resource}.${scope}.${action}`;
	if (userPermissions.includes(exact)) return true;

	const wildcard = `${resource}.${scope}.*`;
	if (userPermissions.includes(wildcard)) return true;

	for (const p of userPermissions) {
		const parts = p.split(".");
		if (parts.length !== 3 || parts[0] !== resource) continue;
		const upScope = Number(parts[1]);
		const upAction = Number(parts[2]);
		if (Number.isNaN(upScope) || Number.isNaN(upAction)) continue;
		if ((upScope & scope) === scope && (upAction & action) === action) return true;
	}
	return false;
}

/** Alias para retrocompatibilidad. */
export const CommunityScope = COMMUNITY_SCOPES_MAP;

export const canComment = (perms: readonly string[]) =>
	hasAnyPermission(perms, "community", CommunityScope.SOCIAL, CRUDXAction.WRITE);

export const canRate = canComment;

export const canPublish = (perms: readonly string[]) =>
	hasAnyPermission(perms, "community", CommunityScope.PUBLISH_STATUS, CRUDXAction.WRITE);

export const canEditContent = (perms: readonly string[]) =>
	hasAnyPermission(perms, "community", CommunityScope.CONTENT, CRUDXAction.WRITE) ||
	hasAnyPermission(perms, "community", CommunityScope.CONTENT, CRUDXAction.UPDATE);

export const canDeleteSocial = (perms: readonly string[]) =>
	hasAnyPermission(perms, "community", CommunityScope.SOCIAL, CRUDXAction.DELETE);
