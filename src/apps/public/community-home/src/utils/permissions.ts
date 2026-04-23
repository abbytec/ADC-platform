/**
 * Helper de permisos para community-home.
 * Usa la utilidad compartida hasPermission de @common/types/Permissions.
 */

import { P, hasPermission } from "@common/types/Permissions.js";
import type { CRUDXAction } from "@common/types/Actions.js";

export type CRUDXActionValue = (typeof CRUDXAction)[keyof typeof CRUDXAction];

export { hasPermission };

export const canComment = (perms: readonly string[]) => hasPermission(perms, P.COMMUNITY.SOCIAL.WRITE);

export const canRate = canComment;

export const canPublish = (perms: readonly string[]) => hasPermission(perms, P.COMMUNITY.PUBLISH_STATUS.WRITE);

export const canEditContent = (perms: readonly string[]) =>
	hasPermission(perms, P.COMMUNITY.CONTENT.WRITE) || hasPermission(perms, P.COMMUNITY.CONTENT.UPDATE);

export const canDeleteSocial = (perms: readonly string[]) => hasPermission(perms, P.COMMUNITY.SOCIAL.DELETE);