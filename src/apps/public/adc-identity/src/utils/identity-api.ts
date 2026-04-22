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
	getMyPermissions: () => api.get<{ perms: Permission[]; orgId?: string; isAdmin?: boolean; isOrgAdmin?: boolean }>("/my-permissions"),

	// Users
	listUsers: (orgId?: string) => api.get<{ users: ClientUser[]; roles: Role[] }>("/users", orgId ? { params: { orgId } } : undefined),
	searchUsers: (q: string, orgId?: string) => api.get<ClientUser[]>("/users/search", { params: { q, orgId } }),
	getUser: (userId: string) => api.get<ClientUser>(`/users/${userId}`),
	createUser: (data: { username: string; password: string; roleIds?: string[]; orgId?: string }) =>
		api.post<ClientUser>("/users", { body: data, idempotencyData: data }),
	updateUser: (userId: string, data: Partial<ClientUser>, orgId?: string) =>
		api.put<ClientUser>(`/users/${userId}`, { body: data, params: { orgId }, idempotencyKey: userId }),
	deleteUser: (userId: string, orgId?: string) => api.delete(`/users/${userId}`, { params: { orgId }, idempotencyKey: userId }),

	// Roles
	listRoles: (orgId?: string) => api.get<Role[]>("/roles", orgId ? { params: { orgId } } : undefined),
	getRole: (roleId: string) => api.get<Role>(`/roles/${roleId}`),
	createRole: (data: { name: string; description: string; permissions?: Permission[]; orgId?: string }) =>
		api.post<Role>("/roles", { body: data, idempotencyData: data }),
	updateRole: (roleId: string, data: Partial<Role>) => api.put<Role>(`/roles/${roleId}`, { body: data, idempotencyKey: roleId }),
	deleteRole: (roleId: string) => api.delete(`/roles/${roleId}`, { idempotencyKey: roleId }),

	// Groups
	listGroups: (orgId?: string) => api.get<Group[]>("/groups", orgId ? { params: { orgId } } : undefined),
	getGroup: (groupId: string) => api.get<Group>(`/groups/${groupId}`),
	createGroup: (data: { name: string; description: string; roleIds?: string[]; orgId?: string }) =>
		api.post<Group>("/groups", { body: data, idempotencyData: data }),
	updateGroup: (groupId: string, data: Partial<Group>) => api.put<Group>(`/groups/${groupId}`, { body: data, idempotencyKey: groupId }),
	deleteGroup: (groupId: string) => api.delete(`/groups/${groupId}`, { idempotencyKey: groupId }),
	listGroupMembers: (groupId: string) => api.get<ClientUser[]>(`/groups/${groupId}/users`),
	addUserToGroup: (groupId: string, userId: string, orgId?: string) =>
		api.post(`/groups/${groupId}/users/${userId}`, { params: { orgId }, idempotencyKey: `${groupId}:${userId}` }),
	removeUserFromGroup: (groupId: string, userId: string, orgId?: string) =>
		api.delete(`/groups/${groupId}/users/${userId}`, { params: { orgId }, idempotencyKey: `${groupId}:${userId}` }),

	// Organizations
	listOrganizations: () => api.get<Organization[]>("/organizations"),
	getOrganization: (orgId: string) => api.get<Organization>(`/organizations/${orgId}`),
	createOrganization: (data: { slug: string; region?: string; metadata?: Record<string, any> }) =>
		api.post<Organization>("/organizations", { body: data, idempotencyData: data }),
	updateOrganization: (orgId: string, data: Partial<Organization>) =>
		api.put<Organization>(`/organizations/${orgId}`, { body: data, idempotencyKey: orgId }),
	deleteOrganization: (orgId: string) => api.delete(`/organizations/${orgId}`, { idempotencyKey: orgId }),
	listOrgMembers: (orgId: string) => api.get<ClientUser[]>(`/organizations/${orgId}/members`),
	addUserToOrg: (orgId: string, userId: string, roleIds?: string[]) =>
		api.post(`/organizations/${orgId}/members/${userId}`, {
			...(roleIds ? { body: { roleIds } } : {}),
			idempotencyKey: `${orgId}:${userId}`,
		}),
	removeUserFromOrg: (orgId: string, userId: string) =>
		api.delete(`/organizations/${orgId}/members/${userId}`, { idempotencyKey: `${orgId}:${userId}` }),

	// Regions
	listRegions: () => api.get<RegionInfo[]>("/regions"),
	createRegion: (data: { path: string; metadata: Record<string, any>; isGlobal?: boolean }) =>
		api.post<RegionInfo>("/regions", { body: data, idempotencyData: data }),
	updateRegion: (path: string, data: Partial<RegionInfo>) => api.put<RegionInfo>(`/regions/${path}`, { body: data, idempotencyKey: path }),
	deleteRegion: (path: string) => api.delete(`/regions/${path}`, { idempotencyKey: path }),

	// Stats
	getStats: () =>
		api.get<{ totalUsers: number; totalRoles: number; totalGroups: number; totalOrganizations: number; totalRegions: number }>("/stats"),
};
