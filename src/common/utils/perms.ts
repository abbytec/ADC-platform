import { Permission } from "@common/types/identity/Permission.ts";
import { PMScopes, PM_RESOURCE_NAME } from "@common/types/project-manager/permissions.ts";

/**
 * Bit `SELF` por recurso: cuando está presente en el permiso, sólo aplica si
 * `opts.selfId === opts.ownerId`. `identity.SELF` NO se lista porque es un
 * scope regular (el propio perfil).
 */
const SELF_MODIFIER_BY_RESOURCE: Record<string, number> = {
	[PM_RESOURCE_NAME]: PMScopes.SELF,
};

export interface HasPermissionOpts {
	selfId?: string;
	ownerId?: string;
}

export function hasPermission(
	perms: Permission[] | null | undefined,
	resource: string,
	requiredAction: number,
	requiredScope: number,
	opts?: HasPermissionOpts
): boolean {
	if (!perms?.length) return false;

	const selfBit = SELF_MODIFIER_BY_RESOURCE[resource] ?? 0;

	for (const p of perms) {
		if (p.resource !== resource && p.resource !== "*") continue;
		if ((p.action & requiredAction) !== requiredAction) continue;
		if ((p.scope & requiredScope) !== requiredScope) continue;

		const permHasSelf = selfBit !== 0 && (p.scope & selfBit) !== 0;
		if (permHasSelf && opts?.selfId !== undefined && opts?.ownerId !== undefined && opts.selfId !== opts.ownerId) {
			continue;
		}
		return true;
	}
	return false;
}
