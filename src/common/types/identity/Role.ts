import { Permission } from "./Permission.ts";

/**
 * Definición de rol
 */
export interface Role {
	id: string;
	name: string;
	description: string;
	permissions: Permission[];
	isCustom: boolean;
	/** Organización a la que pertenece (null = global/predefinido) */
	orgId?: string | null;
	createdAt: Date;
}
