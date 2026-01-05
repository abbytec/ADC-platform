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
