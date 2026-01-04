import { Schema, type Model } from "mongoose";
import type { Role, Permission } from "../types.js";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.js";
import { RESOURCE_NAME, Scope } from "../permissions.js";
import { Action } from "../../../../interfaces/behaviours/Actions.ts";

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
	constructor(private readonly roleModel: Model<any>, private readonly logger: ILogger) {}

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

	async createRole(name: string, description: string, permissions?: Permission[]): Promise<Role> {
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

	async getRole(roleId: string): Promise<Role | null> {
		try {
			const doc = await this.roleModel.findOne({ id: roleId });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo rol: ${error}`);
			return null;
		}
	}

	async getRoleByName(name: string): Promise<Role | null> {
		try {
			const doc = await this.roleModel.findOne({ name });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo rol por nombre: ${error}`);
			return null;
		}
	}

	async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
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

	async deleteRole(roleId: string): Promise<void> {
		try {
			await this.roleModel.deleteOne({ id: roleId });
			this.logger.logDebug(`Rol eliminado: ${roleId}`);
		} catch (error) {
			this.logger.logError(`Error eliminando rol: ${error}`);
			throw error;
		}
	}

	async getAllRoles(): Promise<Role[]> {
		try {
			const docs = await this.roleModel.find({});
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo roles: ${error}`);
			return [];
		}
	}

	async getPredefinedRoles(): Promise<Role[]> {
		try {
			const docs = await this.roleModel.find({ isCustom: false });
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo roles predefinidos: ${error}`);
			return [];
		}
	}
}
