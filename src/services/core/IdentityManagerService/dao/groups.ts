import type { Model } from "mongoose";
import type { Group, User } from "@common/types/identity/index.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "@common/utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "@common/types/auth-verifier.ts";
import { IdentityScopes } from "@common/types/identity/permissions.ts";
import { CRUDXAction } from "@common/types/Actions.js";
import type { UserManager } from "./users.js";

export class GroupManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly groupModel: Model<any>,
		private readonly userManager: UserManager,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "GroupManager");
	}

	/**
	 * Crea un grupo
	 * @param token Token de autenticación (requerido para verificar permisos)
	 * @param orgId Organización a la que pertenece el grupo (undefined = global)
	 */
	async createGroup(name: string, description: string, roleIds?: string[], token?: string, orgId?: string): Promise<Group> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScopes.GROUPS, orgId);

		try {
			const groupId = generateId();
			const group: Group = {
				id: groupId,
				name,
				description,
				roleIds: roleIds || [],
				orgId: orgId || null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			await this.groupModel.create(group);
			this.logger.logDebug(`Grupo creado: ${name}`);
			return group;
		} catch (error) {
			this.logger.logError(`Error creando grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene un grupo por ID
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getGroup(groupId: string, token?: string): Promise<Group | null> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.GROUPS);

		try {
			const doc = await this.groupModel.findOne({ id: groupId });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo grupo: ${error}`);
			return null;
		}
	}

	/**
	 * Actualiza un grupo
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async updateGroup(groupId: string, updates: Partial<Group>, token?: string): Promise<Group> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, IdentityScopes.GROUPS);

		try {
			updates.updatedAt = new Date();
			const updated = await this.groupModel.findOneAndUpdate({ id: groupId }, updates, { new: true });
			if (!updated) throw new Error(`Grupo ${groupId} no encontrado`);
			this.logger.logDebug(`Grupo actualizado: ${groupId}`);
			return updated.toObject?.() || updated;
		} catch (error) {
			this.logger.logError(`Error actualizando grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Elimina un grupo
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async deleteGroup(groupId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScopes.GROUPS);

		try {
			await this.userManager.removeGroupFromAll(groupId, token);
			await this.groupModel.deleteOne({ id: groupId });
			this.logger.logDebug(`Grupo eliminado: ${groupId}`);
		} catch (error) {
			this.logger.logError(`Error eliminando grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Elimina TODOS los grupos de una organización con cascade.
	 * Usado por OrgManager al eliminar una organización.
	 */
	async deleteAllForOrg(orgId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScopes.GROUPS);

		const groups = await this.groupModel.find({ orgId });
		for (const group of groups) {
			await this.userManager.removeGroupFromAll(group.id, token);
		}
		await this.groupModel.deleteMany({ orgId });
		this.logger.logDebug(`Todos los grupos de org ${orgId} eliminados con cascade (${groups.length})`);
	}

	/**
	 * Obtiene todos los grupos, separados por contexto.
	 * - Con orgId: solo grupos de esta org
	 * - Sin orgId (admin global): solo grupos globales (orgId === null)
	 * @param token Token de autenticación (requerido para verificar permisos)
	 * @param orgId Si se proporciona, retorna solo grupos de esta org
	 */
	async getAllGroups(token?: string, orgId?: string): Promise<Group[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.GROUPS, orgId);

		try {
			const filter = orgId ? { orgId } : { $or: [{ orgId: null }, { orgId: { $exists: false } }] };
			const docs = await this.groupModel.find(filter);
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo grupos: ${error}`);
			return [];
		}
	}

	/**
	 * Agrega un usuario a un grupo (solo modifica user.groupIds)
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async addUserToGroup(userId: string, groupId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScopes.GROUPS | IdentityScopes.USERS);

		try {
			const group = await this.groupModel.findOne({ id: groupId });
			if (!group) throw new Error(`Grupo ${groupId} no encontrado`);
			await this.userManager.addToGroup(userId, groupId, token);
			this.logger.logDebug(`Usuario ${userId} agregado al grupo ${groupId}`);
		} catch (error) {
			this.logger.logError(`Error agregando usuario a grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Remueve un usuario de un grupo (solo modifica user.groupIds)
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async removeUserFromGroup(userId: string, groupId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScopes.GROUPS | IdentityScopes.USERS);

		try {
			await this.userManager.removeFromGroup(userId, groupId, token);
			this.logger.logDebug(`Usuario ${userId} removido del grupo ${groupId}`);
		} catch (error) {
			this.logger.logError(`Error removiendo usuario del grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene todos los usuarios que pertenecen a un grupo
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getGroupUsers(groupId: string, token?: string): Promise<User[]> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScopes.GROUPS | IdentityScopes.USERS);

		try {
			return await this.userManager.getUsersByGroup(groupId, token);
		} catch (error) {
			this.logger.logError(`Error obteniendo usuarios del grupo: ${error}`);
			return [];
		}
	}

	/**
	 * Remueve un roleId de todos los grupos.
	 * Usado por RoleManager al eliminar un rol.
	 */
	async removeRoleFromAll(roleId: string, token?: string): Promise<void> {
		await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, IdentityScopes.GROUPS);

		await this.groupModel.updateMany({ roleIds: roleId }, { $pull: { roleIds: roleId } });
	}
}
