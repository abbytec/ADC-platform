import type { Model } from "mongoose";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.ts";
import { IdentityScope } from "@common/types/identity.js";
import { CRUDXAction } from "@common/types/Actions.ts";
import { type AuthVerifierGetter, PermissionChecker } from "../utils/auth-verifier.ts";
import type { Permission, Role } from "../domain/index.ts";
import { PREDEFINED_ROLES } from "../defaults/systemRoles.ts";

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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScope.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, IdentityScope.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScope.ROLES);
		}

		const role = (await this.roleModel.findOne({ id: roleId }).lean()) as Role | null;
		if (!role) {
			throw new Error(`Rol ${roleId} no encontrado`);
		}
		if (!role.isCustom) {
			throw new Error("No se pueden eliminar roles predefinidos");
		}

		const result = await this.roleModel.deleteOne({ id: roleId });
		if (result.deletedCount === 0) {
			throw new Error(`No se pudo eliminar el rol ${roleId}`);
		}
		this.logger.logOk(`Rol eliminado: ${roleId} (${role.name})`);
	}

	/**
	 * Obtiene todos los roles
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getAllRoles(token?: string): Promise<Role[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.ROLES);
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
