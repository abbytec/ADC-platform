import type { Model } from "mongoose";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.ts";
import { IdentityScopes } from "@common/types/identity/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.ts";
import { type AuthVerifierGetter, PermissionChecker } from "../utils/auth-verifier.ts";
import type { Permission, Role } from "@common/types/identity/index.ts";
import { PREDEFINED_ROLES, ORG_PREDEFINED_ROLES } from "../defaults/systemRoles.ts";

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
	 * Inicializa roles predefinidos del sistema o de una organización.
	 * Sin orgId: crea roles globales (PREDEFINED_ROLES).
	 * Con orgId: crea roles de organización (ORG_PREDEFINED_ROLES, sin SYSTEM).
	 * No requiere token (es proceso de inicialización).
	 */
	async initializePredefinedRoles(orgId?: string): Promise<void> {
		const roles = orgId ? ORG_PREDEFINED_ROLES : PREDEFINED_ROLES;
		const scopeLabel = orgId ? ` [org: ${orgId}]` : " [global]";

		for (const roleData of roles) {
			try {
				// Chequeo de duplicado incluye orgId para evitar colisiones de nombre entre contextos
				const filter = orgId ? { name: roleData.name, orgId } : { name: roleData.name, orgId: null };

				const existing = await this.roleModel.findOne(filter);
				if (!existing) {
					await this.roleModel.create({
						id: generateId(),
						name: roleData.name,
						description: roleData.description,
						permissions: roleData.permissions,
						isCustom: false,
						orgId: orgId || null,
						createdAt: new Date(),
					});
				}

				this.logger.logDebug(`Rol predefinido disponible: ${roleData.name}${scopeLabel}`);
			} catch (error) {
				this.logger.logError(`Error inicializando rol ${roleData.name}: ${error}`);
			}
		}
	}

	/**
	 * Crea un rol personalizado
	 * @param token Token de autenticación (requerido para verificar permisos)
	 * @param orgId Organización a la que pertenece el rol (undefined = global)
	 */
	async createRole(name: string, description: string, permissions?: Permission[], token?: string, orgId?: string): Promise<Role> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScopes.ROLES, orgId);
		}

		try {
			const roleId = generateId();
			const role: Role = {
				id: roleId,
				name,
				description,
				permissions: permissions || [],
				isCustom: true,
				orgId: orgId || null,
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ROLES);
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
	 * Obtiene múltiples roles por sus IDs en una sola consulta
	 */
	async getRolesByIds(roleIds: string[], token?: string, orgId?: string): Promise<Role[]> {
		if (!roleIds.length) return [];
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ROLES, orgId);
		}
		try {
			const docs = await this.roleModel.find({ id: { $in: roleIds } });
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo roles por IDs: ${error}`);
			return [];
		}
	}

	/**
	 * Obtiene un rol por nombre
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getRoleByName(name: string, token?: string): Promise<Role | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, IdentityScopes.ROLES);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScopes.ROLES);
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
	 * Obtiene todos los roles, separados por contexto.
	 * - Con orgId: roles predefinidos de la org + custom de la org + predefinidos globales (como referencia)
	 * - Sin orgId (admin global): solo roles globales (orgId === null)
	 * @param token Token de autenticación (requerido para verificar permisos)
	 * @param orgId Si se proporciona, retorna roles de esta org + globales predefinidos
	 */
	async getAllRoles(token?: string, orgId?: string): Promise<Role[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ROLES, orgId);
		}

		try {
			const filter = orgId
				? {
						$or: [
							{ orgId }, // Roles de esta org (predefinidos + custom)
							{ orgId: null, isCustom: false }, // Predefinidos globales (referencia readonly)
						],
					}
				: { orgId: null }; // Solo roles globales
			const docs = await this.roleModel.find(filter);
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
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.ROLES);
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
