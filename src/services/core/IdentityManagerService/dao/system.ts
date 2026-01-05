import type { Model } from "mongoose";
import type { User } from "../domain/user.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId, hashPassword, generateRandomCredentials } from "../utils/crypto.ts";
import { SystemRole } from "../defaults/systemRoles.ts";
import { OnlyKernel } from "../../../../utils/decorators/OnlyKernel.ts";

/* tslint:disable:no-unused-variable */
export class SystemManager {
	#systemUser: User | null = null;
	constructor(
		private readonly userModel: Model<any>,
		private readonly roleModel: Model<any>,
		private readonly groupModel: Model<any>,
		private readonly logger: ILogger,
		private readonly kernelKey: symbol
	) {}

	async initializeSystemUser(): Promise<void> {
		try {
			const { username, password } = generateRandomCredentials();

			// Obtener role SYSTEM
			const systemRole = await this.roleModel.findOne({ name: SystemRole.SYSTEM });
			const systemRoleId = systemRole?.id || generateId();

			const userId = generateId();
			const passwordHash = hashPassword(password);

			this.#systemUser = {
				id: userId,
				username,
				passwordHash,
				roleIds: [systemRoleId],
				groupIds: [],
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Eliminar usuarios SYSTEM anteriores
			await this.userModel.deleteMany({ username: { $regex: "^system_" } });
			// Crear nuevo usuario SYSTEM
			await this.userModel.create(this.#systemUser);

			this.logger.logOk(`Usuario SYSTEM creado: ${username} (Contraseña disponible solo en este arranque)`);
			this.logger.logInfo(`[SYSTEM USER CREDENTIALS] Username: ${username}, Password: ${password}`);
		} catch (error) {
			this.logger.logError(`Error inicializando usuario SYSTEM: ${error}`);
		}
	}

	/**
	 * Obtiene el usuario SYSTEM.
	 * REQUIERE kernelKey - solo código con acceso al kernel puede obtener el usuario SYSTEM.
	 * @param kernelKey - La clave del kernel para verificar acceso privilegiado
	 */
	@OnlyKernel()
	async getSystemUser(_kernelKey: symbol): Promise<User> {
		void this.kernelKey; // Para evitar el error de typescript (no ts-lint) unused variable
		if (!this.#systemUser) {
			throw new Error("Usuario SYSTEM no está disponible");
		}
		return this.#systemUser;
	}
	@OnlyKernel()
	clearSystemUser(_kernelKey: symbol): void {
		this.#systemUser = null;
	}

	async getStats(): Promise<{
		totalUsers: number;
		totalRoles: number;
		totalGroups: number;
		systemUserExists: boolean;
	}> {
		try {
			const totalUsers = await this.userModel.countDocuments();
			const totalRoles = await this.roleModel.countDocuments();
			const totalGroups = await this.groupModel.countDocuments();

			return {
				totalUsers,
				totalRoles,
				totalGroups,
				systemUserExists: this.#systemUser !== null,
			};
		} catch (error) {
			this.logger.logError(`Error obteniendo estadísticas: ${error}`);
			return {
				totalUsers: 0,
				totalRoles: 0,
				totalGroups: 0,
				systemUserExists: false,
			};
		}
	}
}
