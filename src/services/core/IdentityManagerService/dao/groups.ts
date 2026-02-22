import type { Model } from "mongoose";
import type { Group, User } from "../domain/index.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "../utils/auth-verifier.ts";
import { Action, IdentityScope } from "@common/types/identity.js";

export class GroupManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly groupModel: Model<any>,
		private readonly userModel: Model<any>,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "GroupManager");
	}

	/**
	 * Crea un grupo
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async createGroup(name: string, description: string, roleIds?: string[], token?: string): Promise<Group> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.WRITE, IdentityScope.GROUPS);
		}

		try {
			const groupId = generateId();
			const group: Group = {
				id: groupId,
				name,
				description,
				roleIds: roleIds || [],
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
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, IdentityScope.GROUPS);
		}

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
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.UPDATE, IdentityScope.GROUPS);
		}

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
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.DELETE, IdentityScope.GROUPS);
		}

		try {
			// Remover groupId de todos los usuarios que pertenecen a este grupo
			await this.userModel.updateMany({ groupIds: groupId }, { $pull: { groupIds: groupId } });

			await this.groupModel.deleteOne({ id: groupId });
			this.logger.logDebug(`Grupo eliminado: ${groupId}`);
		} catch (error) {
			this.logger.logError(`Error eliminando grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene todos los grupos
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getAllGroups(token?: string): Promise<Group[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, IdentityScope.GROUPS);
		}

		try {
			const docs = await this.groupModel.find({});
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
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.WRITE, IdentityScope.GROUPS | IdentityScope.USERS);
		}

		try {
			const group = await this.groupModel.findOne({ id: groupId });
			if (!group) throw new Error(`Grupo ${groupId} no encontrado`);

			const result = await this.userModel.findOneAndUpdate({ id: userId }, { $addToSet: { groupIds: groupId }, updatedAt: new Date() });

			if (!result) throw new Error(`Usuario ${userId} no encontrado`);

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
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.DELETE, IdentityScope.GROUPS | IdentityScope.USERS);
		}

		try {
			const result = await this.userModel.findOneAndUpdate({ id: userId }, { $pull: { groupIds: groupId }, updatedAt: new Date() });

			if (!result) throw new Error(`Usuario ${userId} no encontrado`);

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
		if (token) {
			await this.#permissionChecker.requirePermission(token, Action.READ, IdentityScope.GROUPS | IdentityScope.USERS);
		}

		try {
			const docs = await this.userModel.find({ groupIds: groupId });
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo usuarios del grupo: ${error}`);
			return [];
		}
	}
}
