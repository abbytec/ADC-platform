import { Schema, type Model } from "mongoose";
import type { Group } from "../types.js";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId } from "../utils/crypto.js";

export const groupSchema = new Schema({
	id: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	description: String,
	roleIds: [String],
	userIds: [String],
	metadata: Schema.Types.Mixed,
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

export class GroupManager {
	constructor(private readonly groupModel: Model<any>, private readonly userModel: Model<any>, private readonly logger: ILogger) {}

	async createGroup(name: string, description: string, roleIds?: string[]): Promise<Group> {
		try {
			const groupId = generateId();
			const group: Group = {
				id: groupId,
				name,
				description,
				roleIds: roleIds || [],
				userIds: [],
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

	async deleteGroup(groupId: string): Promise<void> {
		try {
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

	async addUserToGroup(userId: string, groupId: string): Promise<void> {
		try {
			const user = await this.userModel.findOne({ id: userId });
			const group = await this.groupModel.findOne({ id: groupId });

			if (!user) throw new Error(`Usuario ${userId} no encontrado`);
			if (!group) throw new Error(`Grupo ${groupId} no encontrado`);

			if (!user.groupIds.includes(groupId)) {
				user.groupIds.push(groupId);
				await user.save();
			}

			if (!group.userIds.includes(userId)) {
				group.userIds.push(userId);
				await group.save();
			}
		} catch (error) {
			this.logger.logError(`Error agregando usuario a grupo: ${error}`);
			throw error;
		}
	}

	async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
		try {
			const user = await this.userModel.findOne({ id: userId });
			const group = await this.groupModel.findOne({ id: groupId });

			if (!user) throw new Error(`Usuario ${userId} no encontrado`);
			if (!group) throw new Error(`Grupo ${groupId} no encontrado`);

			user.groupIds = user.groupIds.filter((gid: string) => gid !== groupId);
			group.userIds = group.userIds.filter((uid: string) => uid !== userId);

			await user.save();
			await group.save();
		} catch (error) {
			this.logger.logError(`Error removiendo usuario del grupo: ${error}`);
			throw error;
		}
	}
}
