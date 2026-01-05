import { Schema, type Model } from "mongoose";
import type { Role, Permission } from "../types.js";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.js";
import { RESOURCE_NAME, Scope } from "../permissions.js";
import { Action } from "../../../../interfaces/behaviours/Actions.ts";
import { type AuthVerifierGetter, PermissionChecker } from "../utils/auth-verifier.js";

export const roleSchema = new Schema({
	id: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	description: String,
	permissions: [
		{
			resource: { type: String, required: true },
			action: { type: Number, required: true }, // Bitfield
			scope: { type: Number, required: true }, // Bitfield
		},
	],
	isCustom: { type: Boolean, default: false },
	createdAt: { type: Date, default: Date.now },
});

export enum SystemRole {
	SYSTEM = "SYSTEM",
	ADMIN = "Admin",
	NETWORK_MANAGER = "Network Manager",
	SECURITY_MANAGER = "Security Manager",
	DATA_MANAGER = "Data Manager",
	APP_MANAGER = "App Manager",
	CONFIG_MANAGER = "Config Manager",
	USER = "User",
}

const PREDEFINED_ROLES: Array<{ name: SystemRole; description: string; permissions: Permission[] }> = [
	{
		name: SystemRole.SYSTEM,
		description: "Usuario del sistema con acceso total",
		permissions: [{ resource: RESOURCE_NAME, action: Action.CRUD, scope: Scope.ALL }],
	},
	{
		name: SystemRole.ADMIN,
		description: "Administrador del sistema",
		permissions: [{ resource: RESOURCE_NAME, action: Action.CRUD, scope: Scope.ALL }],
	},
	{
		name: SystemRole.NETWORK_MANAGER,
		description: "Gestor de redes",
		permissions: [
			{ resource: "network", action: Action.CRUD, scope: 0xff },
			{ resource: "devices", action: Action.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.SECURITY_MANAGER,
		description: "Gestor de seguridad",
		permissions: [
			{ resource: "security", action: Action.CRUD, scope: 0xff },
			{ resource: "users", action: Action.READ, scope: 0xff },
			{ resource: "audit", action: Action.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.DATA_MANAGER,
		description: "Gestor de datos",
		permissions: [
			{ resource: "data", action: Action.CRUD, scope: 0xff },
			{ resource: "database", action: Action.CRUD, scope: 0xff },
		],
	},
	{
		name: SystemRole.APP_MANAGER,
		description: "Gestor de aplicaciones",
		permissions: [
			{ resource: "apps", action: Action.CRUD, scope: 0xff },
			{ resource: "modules", action: Action.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.CONFIG_MANAGER,
		description: "Gestor de configuración",
		permissions: [
			{ resource: "config", action: Action.CRUD, scope: 0xff },
			{ resource: "system", action: Action.READ, scope: 0xff },
		],
	},
	{
		name: SystemRole.USER,
		description: "Usuario estándar del sistema",
		permissions: [{ resource: RESOURCE_NAME, action: Action.READ, scope: Scope.SELF }],
	},
];

export class RoleManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly roleModel: Model<any>,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "RoleManager");
	}

	/**
	 * Inicializa roles predefinidos del sistema
	 * No requiere token (es proceso de inicialización)
	 */
	async initializePredefinedRoles(): Promise<void> {
		for (const roleData of PREDEFINED_ROLES) {
			try {
				const roleId = generateId();
				const role: Role = {
					id: roleId,
					name: roleData.name,
					description: roleData.description,
					permissions: roleData.permissions,
					isCustom: false,
					createdAt: new Date(),
				};

				const existing = await this.roleModel.findOne({ name: role.name });
				if (!existing) {
					await this.roleModel.create(role);
				}

				this.logger.logDebug(`Rol predefinido disponible: ${role.name}`);
			} catch (error) {
				this.logger.logError(`Error inicializando rol ${roleData.name}: ${error}`);
			}
		}
	}

	/**
	 * Crea un rol personalizado
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async createRole(name: string, description: string, permissions?: Permission[], token?: string): Promise<Role> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.WRITE, Scope.ROLES);
		}

		try {
			const roleId = generateId();
			const role: Role = {
				id: roleId,
				name,
				description,
				permissions: permissions || [],
				isCustom: true,
				createdAt: new Date(),
			};

			await this.roleModel.create(role);
			this.logger.logDebug(`Rol personalizado creado: ${name}`);
			return role;
		} catch (error) {
			this.logger.logError(`Error creando rol: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene un rol por ID
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getRole(roleId: string, token?: string): Promise<Role | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, Scope.ROLES);
		}

		try {
			const doc = await this.roleModel.findOne({ id: roleId });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo rol: ${error}`);
			return null;
		}
	}

	/**
	 * Obtiene un rol por nombre
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getRoleByName(name: string, token?: string): Promise<Role | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, Scope.ROLES);
		}

		try {
			const doc = await this.roleModel.findOne({ name });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo rol por nombre: ${error}`);
			return null;
		}
	}

	/**
	 * Actualiza un rol
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async updateRole(roleId: string, updates: Partial<Role>, token?: string): Promise<Role> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.UPDATE, Scope.ROLES);
		}

		try {
			const updated = await this.roleModel.findOneAndUpdate({ id: roleId }, updates, { new: true });
			if (!updated) throw new Error(`Rol ${roleId} no encontrado`);
			this.logger.logDebug(`Rol actualizado: ${roleId}`);
			return updated.toObject?.() || updated;
		} catch (error) {
			this.logger.logError(`Error actualizando rol: ${error}`);
			throw error;
		}
	}

	/**
	 * Elimina un rol
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async deleteRole(roleId: string, token?: string): Promise<void> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.DELETE, Scope.ROLES);
		}

		try {
			await this.roleModel.deleteOne({ id: roleId });
			this.logger.logDebug(`Rol eliminado: ${roleId}`);
		} catch (error) {
			this.logger.logError(`Error eliminando rol: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene todos los roles
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getAllRoles(token?: string): Promise<Role[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, Scope.ROLES);
		}

		try {
			const docs = await this.roleModel.find({});
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo roles: ${error}`);
			return [];
		}
	}

	/**
	 * Obtiene los roles predefinidos
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getPredefinedRoles(token?: string): Promise<Role[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, Scope.ROLES);
		}

		try {
			const docs = await this.roleModel.find({ isCustom: false });
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo roles predefinidos: ${error}`);
			return [];
		}
	}
}
