/**
 * Permiso del sistema (bitfield-based)
 *
 * action: Bitfield de Action (READ=1, WRITE=2, DELETE=4, EXECUTE=8, ALL=15)
 * scope: Bitfield de Scope (SELF=1, USERS=2, ROLES=4, GROUPS=8, ORGANIZATIONS=16, REGIONS=32, STATS=64, ALL=127)
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
	action: number; // Bitfield de acciones
	scope: number; // Bitfield de alcance
	granted: boolean;
	source: "user" | "userRole" | "group" | "groupRole" | "org";
}

/**
 * Definición de rol
 */
export interface Role {
	id: string;
	name: string;
	description: string;
	permissions: Permission[];
	isCustom: boolean;
	createdAt: Date;
}

/**
 * Grupo de usuarios
 */
export interface Group {
	id: string;
	name: string;
	description: string;
	roleIds: string[];
	permissions?: Permission[];
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Membresía por organización
 */
export interface OrgMembership {
	orgId: string;
	roleIds: string[];
	joinedAt: Date;
}

/**
 * Usuario del sistema
 */
export interface User {
	id: string;
	username: string;
	passwordHash: string;
	email?: string;
	roleIds: string[];
	groupIds: string[];
	permissions?: Permission[];
	orgMemberships?: OrgMembership[];
	metadata?: Record<string, any>;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	lastLogin?: Date;
}

/**
 * Metadata de región (extensible)
 */
export interface RegionMetadata {
	objectConnectionUri?: string;
	cacheConnectionUri?: string;
	[key: string]: any;
}

/**
 * Información de región
 */
export interface RegionInfo {
	path: string;
	isGlobal: boolean;
	isActive: boolean;
	metadata: RegionMetadata;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Organización
 */
export interface Organization {
	orgId: string;
	slug: string;
	region: string;
	tier: "default";
	status: "active" | "inactive" | "blocked";
	permissions?: Permission[];
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Estadísticas del sistema de identidad
 */
export interface IdentityStats {
	totalUsers: number;
	totalRoles: number;
	totalGroups: number;
	systemUserExists: boolean;
	totalOrganizations: number;
	totalRegions: number;
}

/**
 * Managers con scope de organización
 */
export interface OrgScopedManagers {
	org: Organization;
	users: UserManager;
	roles: RoleManager;
	groups: GroupManager;
	initialize(): Promise<void>;
}
