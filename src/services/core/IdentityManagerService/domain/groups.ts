import { Schema, type Model } from "mongoose";
import type { Group, User } from "../types.js";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.js";

export const groupSchema = new Schema({
	id: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	description: String,
	roleIds: [String],
	permissions: [
		{
			resource: { type: String, required: true },
			action: { type: Number, required: true }, // Bitfield
			scope: { type: Number, required: true }, // Bitfield
		},
	],
	metadata: Schema.Types.Mixed,
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

export class GroupManager {
	constructor(
		private readonly groupModel: Model<any>,
		private readonly userModel: Model<any>,
		private readonly logger: ILogger
	) {}

	async createGroup(name: string, description: string, roleIds?: string[]): Promise<Group> {
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

	async getGroup(groupId: string): Promise<Group | null> {
		try {
			const doc = await this.groupModel.findOne({ id: groupId });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo grupo: ${error}`);
			return null;
		}
	}

	async updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
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

	async deleteGroup(groupId: string): Promise<void> {
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

	async getAllGroups(): Promise<Group[]> {
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
	 */
	async addUserToGroup(userId: string, groupId: string): Promise<void> {
		try {
			const group = await this.groupModel.findOne({ id: groupId });
			if (!group) throw new Error(`Grupo ${groupId} no encontrado`);

			const result = await this.userModel.findOneAndUpdate(
				{ id: userId },
				{ $addToSet: { groupIds: groupId }, updatedAt: new Date() }
			);

			if (!result) throw new Error(`Usuario ${userId} no encontrado`);

			this.logger.logDebug(`Usuario ${userId} agregado al grupo ${groupId}`);
		} catch (error) {
			this.logger.logError(`Error agregando usuario a grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Remueve un usuario de un grupo (solo modifica user.groupIds)
	 */
	async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
		try {
			const result = await this.userModel.findOneAndUpdate(
				{ id: userId },
				{ $pull: { groupIds: groupId }, updatedAt: new Date() }
			);

			if (!result) throw new Error(`Usuario ${userId} no encontrado`);

			this.logger.logDebug(`Usuario ${userId} removido del grupo ${groupId}`);
		} catch (error) {
			this.logger.logError(`Error removiendo usuario del grupo: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene todos los usuarios que pertenecen a un grupo
	 */
	async getGroupUsers(groupId: string): Promise<User[]> {
		try {
			const docs = await this.userModel.find({ groupIds: groupId });
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo usuarios del grupo: ${error}`);
			return [];
		}
	}
}
