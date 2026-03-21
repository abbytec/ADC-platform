import { Permission } from "./Permission.ts";

/**
 * Membresía por organización
 */
interface OrgMembership {
	orgId: string;
	roleIds: string[];
	joinedAt: Date;
}

/**
 * @public Usuario del sistema (frontend)
 */
export interface ClientUser {
	id: string;
	username: string;
	email?: string;
	avatar?: string;
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
 * Usuario del sistema (backend)
 */
export interface User extends ClientUser {
	passwordHash: string;
}
