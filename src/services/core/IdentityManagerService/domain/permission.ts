/**
 * Permiso del sistema (bitfield-based)
 *
 * Los permisos se resuelven por jerarquía (override):
 * user → userRoles → groups → groupRoles → org
 * Niveles más finos sobrescriben al resto. Dentro del mismo nivel se suman.
 */
export interface Permission {
	resource: string;
	action: number; // Bitfield: Action.READ | Action.WRITE, etc.
	scope: number; // Bitfield: Scope.USERS | Scope.GROUPS, etc.
}

/**
 * Permiso resuelto (después de evaluar jerarquía)
 */
export interface ResolvedPermission {
	resource: string;
	action: number;
	scope: number;
	granted: boolean;
	source: "user" | "userRole" | "group" | "groupRole" | "org";
}
