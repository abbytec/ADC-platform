/**
 * Permiso del sistema
 */
export interface Permission {
	resource: string;
	action: "read" | "write" | "delete" | "execute" | "*";
	scope?: "self" | "group" | "all";
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
	userIds: string[];
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
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
	metadata?: Record<string, any>;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	lastLogin?: Date;
}

/**
 * Interfaz del servicio de IdentityManager
 */
export interface IIdentityManager {
	/**
	 * Autentifica un usuario
	 */
	authenticate(username: string, password: string): Promise<User | null>;

	/**
	 * Crea un nuevo usuario
	 */
	createUser(username: string, password: string, roleIds?: string[]): Promise<User>;

	/**
	 * Obtiene un usuario por ID
	 */
	getUser(userId: string): Promise<User | null>;

	/**
	 * Obtiene un usuario por nombre de usuario
	 */
	getUserByUsername(username: string): Promise<User | null>;

	/**
	 * Actualiza un usuario
	 */
	updateUser(userId: string, updates: Partial<User>): Promise<User>;

	/**
	 * Elimina un usuario
	 */
	deleteUser(userId: string): Promise<void>;

	/**
	 * Obtiene todos los usuarios
	 */
	getAllUsers(): Promise<User[]>;

	/**
	 * Crea un nuevo rol
	 */
	createRole(name: string, description: string, permissions?: Permission[]): Promise<Role>;

	/**
	 * Obtiene un rol por ID
	 */
	getRole(roleId: string): Promise<Role | null>;

	/**
	 * Elimina un rol
	 */
	deleteRole(roleId: string): Promise<void>;

	/**
	 * Obtiene todos los roles
	 */
	getAllRoles(): Promise<Role[]>;

	/**
	 * Obtiene los roles predefinidos
	 */
	getPredefinedRoles(): Promise<Role[]>;

	/**
	 * Crea un nuevo grupo
	 */
	createGroup(name: string, description: string, roleIds?: string[]): Promise<Group>;

	/**
	 * Obtiene un grupo por ID
	 */
	getGroup(groupId: string): Promise<Group | null>;

	/**
	 * Elimina un grupo
	 */
	deleteGroup(groupId: string): Promise<void>;

	/**
	 * Obtiene todos los grupos
	 */
	getAllGroups(): Promise<Group[]>;

	/**
	 * Agrega un usuario a un grupo
	 */
	addUserToGroup(userId: string, groupId: string): Promise<void>;

	/**
	 * Elimina un usuario de un grupo
	 */
	removeUserFromGroup(userId: string, groupId: string): Promise<void>;

	/**
	 * Obtiene el usuario del sistema (SYSTEM user)
	 */
	getSystemUser(): Promise<User>;

	/**
	 * Obtiene estadísticas del sistema de identidad
	 */
	getStats(): Promise<{
		totalUsers: number;
		totalRoles: number;
		totalGroups: number;
		systemUserExists: boolean;
	}>;
}
