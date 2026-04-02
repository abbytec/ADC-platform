import { createAdcApi } from "@ui-library/utils/adc-fetch";
import type { ClientUser } from "@common/types/identity/User.ts";
import type { Role } from "@common/types/identity/Role.ts";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Group } from "@common/types/identity/Group.ts";
import type { Organization } from "@common/types/identity/Organization.ts";
import type { RegionInfo } from "@common/types/identity/Region.ts";

/**
 * Identity API client
 * Endpoints expuestos por IdentityManagerService
 */
const api = createAdcApi({
	basePath: "/api/identity",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

// ── API methods ──────────────────────────────────────────────────────────────

export const identityApi = {
	// My Permissions
	getMyPermissions: () => api.get<{ scopes: Permission[]; orgId?: string; isAdmin?: boolean; isOrgAdmin?: boolean }>("/my-permissions"),

	// Users
	listUsers: (orgId?: string) => api.get<{ users: ClientUser[]; roles: Role[] }>("/users", orgId ? { params: { orgId } } : undefined),
	searchUsers: (q: string) => api.get<ClientUser[]>("/users/search", { params: { q } }),
	getUser: (userId: string) => api.get<ClientUser>(`/users/${userId}`),
	createUser: (data: { username: string; password: string; roleIds?: string[]; orgId?: string }) =>
		api.post<ClientUser>("/users", { body: data }),
	updateUser: (userId: string, data: Partial<ClientUser>) => api.put<ClientUser>(`/users/${userId}`, { body: data }),
	deleteUser: (userId: string) => api.delete(`/users/${userId}`),

	// Roles
	listRoles: (orgId?: string) => api.get<Role[]>("/roles", orgId ? { params: { orgId } } : undefined),
	getRole: (roleId: string) => api.get<Role>(`/roles/${roleId}`),
	createRole: (data: { name: string; description: string; permissions?: Permission[]; orgId?: string }) =>
		api.post<Role>("/roles", { body: data }),
	updateRole: (roleId: string, data: Partial<Role>) => api.put<Role>(`/roles/${roleId}`, { body: data }),
	deleteRole: (roleId: string) => api.delete(`/roles/${roleId}`),

	// Groups
	listGroups: (orgId?: string) => api.get<Group[]>("/groups", orgId ? { params: { orgId } } : undefined),
	getGroup: (groupId: string) => api.get<Group>(`/groups/${groupId}`),
	createGroup: (data: { name: string; description: string; roleIds?: string[]; orgId?: string }) => api.post<Group>("/groups", { body: data }),
	updateGroup: (groupId: string, data: Partial<Group>) => api.put<Group>(`/groups/${groupId}`, { body: data }),
	deleteGroup: (groupId: string) => api.delete(`/groups/${groupId}`),
	listGroupMembers: (groupId: string) => api.get<ClientUser[]>(`/groups/${groupId}/users`),
	addUserToGroup: (groupId: string, userId: string) => api.post(`/groups/${groupId}/users/${userId}`),
	removeUserFromGroup: (groupId: string, userId: string) => api.delete(`/groups/${groupId}/users/${userId}`),

	// Organizations
	listOrganizations: () => api.get<Organization[]>("/organizations"),
	getOrganization: (orgId: string) => api.get<Organization>(`/organizations/${orgId}`),
	createOrganization: (data: { slug: string; region?: string; metadata?: Record<string, any> }) =>
		api.post<Organization>("/organizations", { body: data }),
	updateOrganization: (orgId: string, data: Partial<Organization>) => api.put<Organization>(`/organizations/${orgId}`, { body: data }),
	deleteOrganization: (orgId: string) => api.delete(`/organizations/${orgId}`),
	listOrgMembers: (orgId: string) => api.get<ClientUser[]>(`/organizations/${orgId}/members`),
	addUserToOrg: (orgId: string, userId: string, roleIds?: string[]) =>
		api.post(`/organizations/${orgId}/members/${userId}`, roleIds ? { body: { roleIds } } : undefined),
	removeUserFromOrg: (orgId: string, userId: string) => api.delete(`/organizations/${orgId}/members/${userId}`),

	// Regions
	listRegions: () => api.get<RegionInfo[]>("/regions"),
	createRegion: (data: { path: string; metadata: Record<string, any>; isGlobal?: boolean }) =>
		api.post<RegionInfo>("/regions", { body: data }),
	updateRegion: (path: string, data: Partial<RegionInfo>) => api.put<RegionInfo>(`/regions/${path}`, { body: data }),
	deleteRegion: (path: string) => api.delete(`/regions/${path}`),

	// Stats
	getStats: () =>
		api.get<{ totalUsers: number; totalRoles: number; totalGroups: number; totalOrganizations: number; totalRegions: number }>("/stats"),
};
