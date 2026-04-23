import type { ClientUser, User, Role } from "@common/types/identity/index.ts";
import { SystemRole } from "../../../core/IdentityManagerService/defaults/systemRoles.ts";

type AnyUser = ClientUser | User | null | undefined;
export interface RoleReader {
	getRole(roleId: string): Promise<Role | null>;
}

/**
 * Devuelve `true` si el usuario tiene el rol `Admin` a nivel global (sin `orgId`).
 * Un admin global puede gestionar cualquier proyecto (público, org, privado).
 */
export async function hasGlobalAdminRole(roles: RoleReader, user: AnyUser): Promise<boolean> {
	if (!user?.roleIds?.length) return false;
	for (const roleId of user.roleIds) {
		const role = await roles.getRole(roleId);
		if (role?.name === SystemRole.ADMIN && !role.orgId) return true;
	}
	return false;
}

/**
 * Devuelve `true` si el usuario es `Admin` o `Project Manager` dentro de la organización indicada.
 * Estos roles pueden gestionar proyectos de visibilidad `org`.
 */
export async function isOrgAdminOrPM(roles: RoleReader, user: AnyUser, orgId: string | null | undefined): Promise<boolean> {
	if (!orgId || !user?.orgMemberships?.length) return false;
	const membership = user.orgMemberships.find((item) => item.orgId === orgId);
	if (!membership?.roleIds?.length) return false;
	for (const roleId of membership.roleIds) {
		const role = await roles.getRole(roleId);
		if (role?.name === SystemRole.ADMIN || role?.name === SystemRole.PROJECT_MANAGER) return true;
	}
	return false;
}
