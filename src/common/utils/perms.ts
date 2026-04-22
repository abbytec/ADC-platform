import { Permission } from "@common/types/identity/Permission.ts";

export function hasPermission(perms: Permission[], resource: string, requiredAction: number, requiredScope: number): boolean {
	console.log("Checking permission for resource:", resource, "action:", requiredAction, "scope:", requiredScope, "against perms:", perms);
	if (!perms) return false;
	return (
		perms.some(
			(p) =>
				(p.resource === resource || p.resource === "*") &&
				(p.action & requiredAction) === requiredAction &&
				(p.scope & requiredScope) === requiredScope
		) ?? false
	);
}
