import { createAdcApi } from "@ui-library/utils/adc-fetch";

/**
 * Identity API client
 * Endpoints expuestos por IdentityManagerService
 */
const api = createAdcApi({
	basePath: "/api/identity",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
	id: string;
	username: string;
	email?: string;
	roleIds: string[];
	groupIds: string[];
	permissions?: Permission[];
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	lastLogin?: string;
	orgMemberships?: { orgId: string; roleIds: string[]; joinedAt: string }[];
	metadata?: Record<string, any>;
}

export interface Role {
	id: string;
	name: string;
	description: string;
	permissions: Permission[];
	isCustom: boolean;
	createdAt: string;
}

export interface Permission {
	resource: string;
	action: number;
	scope: number;
}

export interface Group {
	id: string;
	name: string;
	description: string;
	roleIds: string[];
	permissions?: Permission[];
	createdAt: string;
	updatedAt: string;
}

export interface Organization {
	orgId: string;
	slug: string;
	region: string;
	tier: string;
	status: "active" | "inactive" | "blocked";
	metadata?: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

export interface Region {
	path: string;
	isGlobal: boolean;
	isActive: boolean;
	metadata: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

export interface IdentityScope {
	action: number;
	scope: number;
	source: string;
}

// ── API methods ──────────────────────────────────────────────────────────────

export const identityApi = {
	// My Permissions
	getMyPermissions: () => api.get<{ scopes: IdentityScope[] }>("/my-permissions"),

	// Users
	listUsers: () => api.get<User[]>("/users"),
	searchUsers: (q: string) => api.get<User[]>("/users/search", { params: { q } }),
	getUser: (userId: string) => api.get<User>(`/users/${userId}`),
	createUser: (data: { username: string; password: string; roleIds?: string[] }) => api.post<User>("/users", { body: data }),
	updateUser: (userId: string, data: Partial<User>) => api.put<User>(`/users/${userId}`, { body: data }),
	deleteUser: (userId: string) => api.delete<{ success: boolean }>(`/users/${userId}`),

	// Roles
	listRoles: () => api.get<Role[]>("/roles"),
	getRole: (roleId: string) => api.get<Role>(`/roles/${roleId}`),
	createRole: (data: { name: string; description: string; permissions?: Permission[] }) => api.post<Role>("/roles", { body: data }),
	updateRole: (roleId: string, data: Partial<Role>) => api.put<Role>(`/roles/${roleId}`, { body: data }),
	deleteRole: (roleId: string) => api.delete<{ success: boolean }>(`/roles/${roleId}`),

	// Groups
	listGroups: () => api.get<Group[]>("/groups"),
	getGroup: (groupId: string) => api.get<Group>(`/groups/${groupId}`),
	createGroup: (data: { name: string; description: string; roleIds?: string[] }) => api.post<Group>("/groups", { body: data }),
	updateGroup: (groupId: string, data: Partial<Group>) => api.put<Group>(`/groups/${groupId}`, { body: data }),
	deleteGroup: (groupId: string) => api.delete<{ success: boolean }>(`/groups/${groupId}`),
	listGroupMembers: (groupId: string) => api.get<User[]>(`/groups/${groupId}/users`),
	addUserToGroup: (groupId: string, userId: string) => api.post<{ success: boolean }>(`/groups/${groupId}/users/${userId}`),
	removeUserFromGroup: (groupId: string, userId: string) => api.delete<{ success: boolean }>(`/groups/${groupId}/users/${userId}`),

	// Organizations
	listOrganizations: () => api.get<Organization[]>("/organizations"),
	getOrganization: (orgId: string) => api.get<Organization>(`/organizations/${orgId}`),
	createOrganization: (data: { slug: string; region?: string; metadata?: Record<string, any> }) =>
		api.post<Organization>("/organizations", { body: data }),
	updateOrganization: (orgId: string, data: Partial<Organization>) => api.put<Organization>(`/organizations/${orgId}`, { body: data }),
	deleteOrganization: (orgId: string) => api.delete<{ success: boolean }>(`/organizations/${orgId}`),

	// Regions
	listRegions: () => api.get<Region[]>("/regions"),
	createRegion: (data: { path: string; metadata: Record<string, any>; isGlobal?: boolean }) => api.post<Region>("/regions", { body: data }),
	updateRegion: (path: string, data: Partial<Region>) => api.put<Region>(`/regions/${path}`, { body: data }),
	deleteRegion: (path: string) => api.delete<{ success: boolean }>(`/regions/${path}`),

	// Stats
	getStats: () =>
		api.get<{ totalUsers: number; totalRoles: number; totalGroups: number; totalOrganizations: number; totalRegions: number }>("/stats"),
};
