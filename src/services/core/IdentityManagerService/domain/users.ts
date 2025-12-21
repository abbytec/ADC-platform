import { Schema, type Model } from "mongoose";
import type { User } from "../types.js";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId, hashPassword, verifyPassword } from "../utils/crypto.js";

export const userSchema = new Schema({
	id: { type: String, required: true, unique: true },
	username: { type: String, required: true, unique: true },
	passwordHash: { type: String, required: true },
	email: String,
	roleIds: [String],
	groupIds: [String],
	metadata: Schema.Types.Mixed,
	isActive: { type: Boolean, default: true },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
	lastLogin: Date,
});
export class UserManager {
	constructor(private readonly userModel: Model<any>, private readonly logger: ILogger) {}

	async authenticate(username: string, password: string): Promise<User | null> {
		try {
			const doc = await this.userModel.findOne({ username });
			const user: User | null = doc?.toObject?.() || doc || null;

			if (!user?.isActive) return null;

			const valid = verifyPassword(password, user.passwordHash);
			if (!valid) return null;

			user.lastLogin = new Date();
			await this.userModel.findByIdAndUpdate(user.id, { lastLogin: user.lastLogin });

			return user;
		} catch (error) {
			this.logger.logError(`Error autenticando usuario: ${error}`);
			return null;
		}
	}

	async createUser(username: string, password: string, roleIds?: string[]): Promise<User> {
		try {
			const userId = generateId();
			const user: User = {
				id: userId,
				username,
				passwordHash: hashPassword(password),
				roleIds: roleIds || [],
				groupIds: [],
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			await this.userModel.create(user);
			this.logger.logDebug(`Usuario creado: ${username}`);
			return user;
		} catch (error: any) {
			if (error.code === 11000) {
				throw new Error(`Usuario ${username} ya existe`);
			}
			throw error;
		}
	}

	async getUser(userId: string): Promise<User | null> {
		try {
			const doc = await this.userModel.findOne({ id: userId });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo usuario: ${error}`);
			return null;
		}
	}

	async getUserByUsername(username: string): Promise<User | null> {
		try {
			const doc = await this.userModel.findOne({ username });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo usuario por username: ${error}`);
			return null;
		}
	}

	async updateUser(userId: string, updates: Partial<User>): Promise<User> {
		try {
			updates.updatedAt = new Date();
			const updated = await this.userModel.findOneAndUpdate({ id: userId }, updates, { new: true });
			if (!updated) throw new Error(`Usuario ${userId} no encontrado`);
			return updated.toObject?.() || updated;
		} catch (error) {
			this.logger.logError(`Error actualizando usuario: ${error}`);
			throw error;
		}
	}

	async deleteUser(userId: string): Promise<void> {
		try {
			await this.userModel.deleteOne({ id: userId });
			this.logger.logDebug(`Usuario eliminado: ${userId}`);
		} catch (error) {
			this.logger.logError(`Error eliminando usuario: ${error}`);
			throw error;
		}
	}

	async getAllUsers(): Promise<User[]> {
		try {
			const docs = await this.userModel.find({});
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo usuarios: ${error}`);
			return [];
		}
	}
}
