import { Permission } from "./Permission.ts";

/**
 * Grupo de usuarios
 */
export interface Group {
	id: string;
	name: string;
	description: string;
	roleIds: string[];
	permissions?: Permission[];
	/** Organización a la que pertenece (null = global) */
	orgId?: string | null;
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}
