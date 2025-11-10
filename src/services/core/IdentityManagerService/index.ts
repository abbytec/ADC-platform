import * as crypto from "node:crypto";
import { BaseService } from "../../BaseService.js";
import type {
	Permission,
	Role,
	Group,
	User,
	IIdentityManager,
} from "./types.js";
import { BaseProvider } from "../../../providers/BaseProvider.js";
/**
 * Roles del sistema predefinidos
 */
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

/**
 * IdentityManagerService - Gestión centralizada de identidades, usuarios, roles y grupos
 *
 * **Modo Kernel:**
 * Este servicio se ejecuta en modo kernel (global: true en config.json),
 * lo que significa que está disponible para toda la plataforma.
 *
 * **Persistencia:**
 * Requiere MongoDB para persistir datos. Si no hay un MongoProvider configurado,
 * el servicio intentará levantar automáticamente los servicios Docker necesarios.
 *
 * **Funcionalidades:**
 * - Gestión de usuarios con contraseñas hasheadas
 * - Sistema de roles predefinidos y personalizados
 * - Grupos de usuarios con asignación de roles
 * - Permisos granulares por recurso y acción
 * - Usuario SYSTEM recreado al arranque con credenciales aleatorias
 * - Autenticación y validación de credenciales
 * - Persistencia en MongoDB
 */
export default class IdentityManagerService extends BaseService<IIdentityManager> {
	public readonly name = "IdentityManagerService";

	private mongoProvider: BaseProvider<any> | null = null;
	private UserModel: any;
	private RoleModel: any;
	private GroupModel: any;
	private systemUser: User | null = null;
	private mongoConfigured = false;

	constructor(kernel: any, options?: any) {
		super(kernel, options);
	}

	async start(): Promise<void> {
		await super.start();

		// Intentar obtener MongoDB (debe estar configurado en alguna app)
		try {
			this.mongoProvider = this.kernel.getProvider<any>("mongo");
			const mongoInstance = await this.mongoProvider?.getInstance();

			// Esperar a que MongoDB esté conectado (máximo 10 segundos)
			const maxWaitTime = 10000;
			const startTime = Date.now();
			while (!mongoInstance?.isConnected() && Date.now() - startTime < maxWaitTime) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			if (!mongoInstance?.isConnected()) {
				throw new Error("MongoDB no pudo conectarse en el tiempo esperado");
			}

			await this.setupMongoose(mongoInstance);
			this.mongoConfigured = true;
			this.logger.logOk("IdentityManagerService usando MongoDB para persistencia");
		} catch (error: any) {
			this.logger.logError(
				"❌ MongoDB no está disponible. IdentityManagerService requiere MongoDB."
			);
			this.logger.logError(
				"Asegúrese de que existe un docker-compose.yml con MongoDB en alguna app que use este servicio."
			);
			throw new Error(`IdentityManagerService requiere MongoDB: ${error.message}`);
		}

		// Inicializar roles predefinidos
		await this.initializePredefinedRoles();

		// Crear o recrear usuario SYSTEM
		await this.initializeSystemUser();

		this.logger.logOk("IdentityManagerService iniciado");
	}

	/**
	 * Configura los modelos de Mongoose
	 */
	private async setupMongoose(mongoInstance: any): Promise<void> {
		const { Schema } = await import("mongoose");

		// Esquema de Usuario
		const userSchema = new Schema({
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

		// Esquema de Rol
		const roleSchema = new Schema({
			id: { type: String, required: true, unique: true },
			name: { type: String, required: true },
			description: String,
			permissions: [
				{
					resource: String,
					action: String,
					scope: String,
				},
			],
			isCustom: { type: Boolean, default: false },
			createdAt: { type: Date, default: Date.now },
		});

		// Esquema de Grupo
		const groupSchema = new Schema({
			id: { type: String, required: true, unique: true },
			name: { type: String, required: true },
			description: String,
			roleIds: [String],
			userIds: [String],
			metadata: Schema.Types.Mixed,
			createdAt: { type: Date, default: Date.now },
			updatedAt: { type: Date, default: Date.now },
		});

		this.UserModel = mongoInstance.createModel("User", userSchema);
		this.RoleModel = mongoInstance.createModel("Role", roleSchema);
		this.GroupModel = mongoInstance.createModel("Group", groupSchema);
	}

	/**
	 * Inicializa los roles predefinidos del sistema
	 */
	private async initializePredefinedRoles(): Promise<void> {
		const roles: Array<{ name: SystemRole; description: string; permissions: Permission[] }> = [
			{
				name: SystemRole.SYSTEM,
				description: "Usuario del sistema con acceso total",
				permissions: [{ resource: "*", action: "*" }],
			},
			{
				name: SystemRole.ADMIN,
				description: "Administrador del sistema",
				permissions: [
					{ resource: "*", action: "*", scope: "all" },
					{ resource: "users", action: "*" },
					{ resource: "roles", action: "*" },
					{ resource: "groups", action: "*" },
				],
			},
			{
				name: SystemRole.NETWORK_MANAGER,
				description: "Gestor de redes",
				permissions: [
					{ resource: "network", action: "*" },
					{ resource: "devices", action: "read" },
				],
			},
			{
				name: SystemRole.SECURITY_MANAGER,
				description: "Gestor de seguridad",
				permissions: [
					{ resource: "security", action: "*" },
					{ resource: "users", action: "read" },
					{ resource: "audit", action: "read" },
				],
			},
			{
				name: SystemRole.DATA_MANAGER,
				description: "Gestor de datos",
				permissions: [
					{ resource: "data", action: "*" },
					{ resource: "database", action: "*" },
				],
			},
			{
				name: SystemRole.APP_MANAGER,
				description: "Gestor de aplicaciones",
				permissions: [
					{ resource: "apps", action: "*" },
					{ resource: "modules", action: "read" },
				],
			},
			{
				name: SystemRole.CONFIG_MANAGER,
				description: "Gestor de configuración",
				permissions: [
					{ resource: "config", action: "*" },
					{ resource: "system", action: "read" },
				],
			},
			{
				name: SystemRole.USER,
				description: "Usuario estándar del sistema",
				permissions: [
					{ resource: "self", action: "read" },
					{ resource: "self", action: "write", scope: "self" },
				],
			},
		];

		for (const roleData of roles) {
			try {
				const roleId = this.generateId();
				const role: Role = {
					id: roleId,
					name: roleData.name,
					description: roleData.description,
					permissions: roleData.permissions,
					isCustom: false,
					createdAt: new Date(),
				};

				if (this.mongoConfigured && this.RoleModel) {
					// Verificar si ya existe
					const existing = await this.RoleModel.findOne({ name: role.name });
					if (!existing) {
						await this.RoleModel.create(role);
					}
				}

				this.logger.logDebug(`Rol predefinido disponible: ${role.name}`);
			} catch (error) {
				this.logger.logError(`Error inicializando rol ${roleData.name}: ${error}`);
			}
		}
	}

	/**
	 * Inicializa el usuario del sistema (SYSTEM user)
	 */
	private async initializeSystemUser(): Promise<void> {
		try {
			// Generar credenciales aleatorias
			const randomUsername = `system_${crypto.randomBytes(4).toString("hex")}`;
			const randomPassword = crypto.randomBytes(16).toString("hex");

			// Obtener role SYSTEM
			let systemRoleId: string;
			if (this.mongoConfigured && this.RoleModel) {
				const systemRole = await this.RoleModel.findOne({ name: SystemRole.SYSTEM });
				systemRoleId = systemRole?.id || this.generateId();
			} else {
				systemRoleId = this.generateId();
			}

			const userId = this.generateId();
			const passwordHash = this.hashPassword(randomPassword);

			this.systemUser = {
				id: userId,
				username: randomUsername,
				passwordHash,
				roleIds: [systemRoleId],
				groupIds: [],
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			if (this.mongoConfigured && this.UserModel) {
				// Eliminar usuarios SYSTEM anteriores
				await this.UserModel.deleteMany({ username: { $regex: "^system_" } });
				// Crear nuevo usuario SYSTEM
				await this.UserModel.create(this.systemUser);
			}

			this.logger.logOk(
				`Usuario SYSTEM creado: ${randomUsername} (Contraseña disponible solo en este arranque)`
			);
			this.logger.logInfo(
				`[SYSTEM USER CREDENTIALS] Username: ${randomUsername}, Password: ${randomPassword}`
			);
		} catch (error) {
			this.logger.logError(`Error inicializando usuario SYSTEM: ${error}`);
		}
	}

	async getInstance(): Promise<IIdentityManager> {
		return {
			authenticate: async (username: string, password: string): Promise<User | null> => {
				try {
					let user: User | null = null;

					if (this.mongoConfigured && this.UserModel) {
						const doc = await this.UserModel.findOne({ username });
						user = doc?.toObject?.() || doc || null;
					}

					if (!user?.isActive) return null;

					const valid = this.verifyPassword(password, user.passwordHash);
					if (!valid) return null;

					user.lastLogin = new Date();
					if (this.mongoConfigured && this.UserModel) {
						await this.UserModel.findByIdAndUpdate(user.id, { lastLogin: user.lastLogin });
					}

					return user;
				} catch (error) {
					this.logger.logError(`Error autenticando usuario: ${error}`);
					return null;
				}
			},

			createUser: async (username: string, password: string, roleIds?: string[]): Promise<User> => {
				try {
					const userId = this.generateId();
					const user: User = {
						id: userId,
						username,
						passwordHash: this.hashPassword(password),
						roleIds: roleIds || [],
						groupIds: [],
						isActive: true,
						createdAt: new Date(),
						updatedAt: new Date(),
					};

					if (this.mongoConfigured && this.UserModel) {
						await this.UserModel.create(user);
					}

					this.logger.logDebug(`Usuario creado: ${username}`);
					return user;
				} catch (error: any) {
					if (error.code === 11000) {
						throw new Error(`Usuario ${username} ya existe`);
					}
					throw error;
				}
			},

			getUser: async (userId: string): Promise<User | null> => {
				try {
					if (this.mongoConfigured && this.UserModel) {
						const doc = await this.UserModel.findOne({ id: userId });
						return doc?.toObject?.() || doc || null;
					}
					return null;
				} catch (error) {
					this.logger.logError(`Error obteniendo usuario: ${error}`);
					return null;
				}
			},

			getUserByUsername: async (username: string): Promise<User | null> => {
				try {
					if (this.mongoConfigured && this.UserModel) {
						const doc = await this.UserModel.findOne({ username });
						return doc?.toObject?.() || doc || null;
					}
					return null;
				} catch (error) {
					this.logger.logError(`Error obteniendo usuario por username: ${error}`);
					return null;
				}
			},

			updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
				try {
					updates.updatedAt = new Date();

					if (this.mongoConfigured && this.UserModel) {
						const updated = await this.UserModel.findOneAndUpdate(
							{ id: userId },
							updates,
							{ new: true }
						);
						if (!updated) throw new Error(`Usuario ${userId} no encontrado`);
						return updated.toObject?.() || updated;
					}

					throw new Error("MongoDB no está configurado");
				} catch (error) {
					this.logger.logError(`Error actualizando usuario: ${error}`);
					throw error;
				}
			},

			deleteUser: async (userId: string): Promise<void> => {
				try {
					if (this.mongoConfigured && this.UserModel) {
						await this.UserModel.deleteOne({ id: userId });
						this.logger.logDebug(`Usuario eliminado: ${userId}`);
					}
				} catch (error) {
					this.logger.logError(`Error eliminando usuario: ${error}`);
					throw error;
				}
			},

			getAllUsers: async (): Promise<User[]> => {
				try {
					if (this.mongoConfigured && this.UserModel) {
						const docs = await this.UserModel.find({});
						return docs.map((d: any) => d.toObject?.() || d);
					}
					return [];
				} catch (error) {
					this.logger.logError(`Error obteniendo usuarios: ${error}`);
					return [];
				}
			},

			createRole: async (name: string, description: string, permissions?: Permission[]): Promise<Role> => {
				try {
					const roleId = this.generateId();
					const role: Role = {
						id: roleId,
						name,
						description,
						permissions: permissions || [],
						isCustom: true,
						createdAt: new Date(),
					};

					if (this.mongoConfigured && this.RoleModel) {
						await this.RoleModel.create(role);
					}

					this.logger.logDebug(`Rol personalizado creado: ${name}`);
					return role;
				} catch (error) {
					this.logger.logError(`Error creando rol: ${error}`);
					throw error;
				}
			},

			getRole: async (roleId: string): Promise<Role | null> => {
				try {
					if (this.mongoConfigured && this.RoleModel) {
						const doc = await this.RoleModel.findOne({ id: roleId });
						return doc?.toObject?.() || doc || null;
					}
					return null;
				} catch (error) {
					this.logger.logError(`Error obteniendo rol: ${error}`);
					return null;
				}
			},

			deleteRole: async (roleId: string): Promise<void> => {
				try {
					if (this.mongoConfigured && this.RoleModel) {
						await this.RoleModel.deleteOne({ id: roleId });
						this.logger.logDebug(`Rol eliminado: ${roleId}`);
					}
				} catch (error) {
					this.logger.logError(`Error eliminando rol: ${error}`);
					throw error;
				}
			},

			getAllRoles: async (): Promise<Role[]> => {
				try {
					if (this.mongoConfigured && this.RoleModel) {
						const docs = await this.RoleModel.find({});
						return docs.map((d: any) => d.toObject?.() || d);
					}
					return [];
				} catch (error) {
					this.logger.logError(`Error obteniendo roles: ${error}`);
					return [];
				}
			},

			getPredefinedRoles: async (): Promise<Role[]> => {
				try {
					if (this.mongoConfigured && this.RoleModel) {
						const docs = await this.RoleModel.find({ isCustom: false });
						return docs.map((d: any) => d.toObject?.() || d);
					}
					return [];
				} catch (error) {
					this.logger.logError(`Error obteniendo roles predefinidos: ${error}`);
					return [];
				}
			},

			createGroup: async (name: string, description: string, roleIds?: string[]): Promise<Group> => {
				try {
					const groupId = this.generateId();
					const group: Group = {
						id: groupId,
						name,
						description,
						roleIds: roleIds || [],
						userIds: [],
						createdAt: new Date(),
						updatedAt: new Date(),
					};

					if (this.mongoConfigured && this.GroupModel) {
						await this.GroupModel.create(group);
					}

					this.logger.logDebug(`Grupo creado: ${name}`);
					return group;
				} catch (error) {
					this.logger.logError(`Error creando grupo: ${error}`);
					throw error;
				}
			},

			getGroup: async (groupId: string): Promise<Group | null> => {
				try {
					if (this.mongoConfigured && this.GroupModel) {
						const doc = await this.GroupModel.findOne({ id: groupId });
						return doc?.toObject?.() || doc || null;
					}
					return null;
				} catch (error) {
					this.logger.logError(`Error obteniendo grupo: ${error}`);
					return null;
				}
			},

			deleteGroup: async (groupId: string): Promise<void> => {
				try {
					if (this.mongoConfigured && this.GroupModel) {
						await this.GroupModel.deleteOne({ id: groupId });
						this.logger.logDebug(`Grupo eliminado: ${groupId}`);
					}
				} catch (error) {
					this.logger.logError(`Error eliminando grupo: ${error}`);
					throw error;
				}
			},

			getAllGroups: async (): Promise<Group[]> => {
				try {
					if (this.mongoConfigured && this.GroupModel) {
						const docs = await this.GroupModel.find({});
						return docs.map((d: any) => d.toObject?.() || d);
					}
					return [];
				} catch (error) {
					this.logger.logError(`Error obteniendo grupos: ${error}`);
					return [];
				}
			},

			addUserToGroup: async (userId: string, groupId: string): Promise<void> => {
				try {
					if (this.mongoConfigured && this.UserModel && this.GroupModel) {
						const user = await this.UserModel.findOne({ id: userId });
						const group = await this.GroupModel.findOne({ id: groupId });

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
					}
				} catch (error) {
					this.logger.logError(`Error agregando usuario a grupo: ${error}`);
					throw error;
				}
			},

			removeUserFromGroup: async (userId: string, groupId: string): Promise<void> => {
				try {
					if (this.mongoConfigured && this.UserModel && this.GroupModel) {
						const user = await this.UserModel.findOne({ id: userId });
						const group = await this.GroupModel.findOne({ id: groupId });

						if (!user) throw new Error(`Usuario ${userId} no encontrado`);
						if (!group) throw new Error(`Grupo ${groupId} no encontrado`);

						user.groupIds = user.groupIds.filter((gid: string) => gid !== groupId);
						group.userIds = group.userIds.filter((uid: string) => uid !== userId);

						await user.save();
						await group.save();
					}
				} catch (error) {
					this.logger.logError(`Error removiendo usuario del grupo: ${error}`);
					throw error;
				}
			},

			getSystemUser: async (): Promise<User> => {
				if (!this.systemUser) {
					throw new Error("Usuario SYSTEM no está disponible");
				}
				return this.systemUser;
			},

			getStats: async () => {
				try {
					let totalUsers = 0,
						totalRoles = 0,
						totalGroups = 0;

					if (this.mongoConfigured && this.UserModel && this.RoleModel && this.GroupModel) {
						totalUsers = await this.UserModel.countDocuments();
						totalRoles = await this.RoleModel.countDocuments();
						totalGroups = await this.GroupModel.countDocuments();
					}

					return {
						totalUsers,
						totalRoles,
						totalGroups,
						systemUserExists: this.systemUser !== null,
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
			},
		};
	}

	/**
	 * Genera un ID único
	 */
	private generateId(): string {
		return crypto.randomUUID();
	}

	/**
	 * Hashea una contraseña con salt
	 */
	private hashPassword(password: string): string {
		const salt = crypto.randomBytes(16).toString("hex");
		const hash = crypto
			.pbkdf2Sync(password, salt, 100000, 64, "sha512")
			.toString("hex");
		return `${salt}:${hash}`;
	}

	/**
	 * Verifica una contraseña contra un hash
	 */
	private verifyPassword(password: string, passwordHash: string): boolean {
		const [salt, hash] = passwordHash.split(":");
		const computed = crypto
			.pbkdf2Sync(password, salt, 100000, 64, "sha512")
			.toString("hex");
		return computed === hash;
	}

	async stop(): Promise<void> {
		// Limpiar datos sensibles
		this.systemUser = null;
		await super.stop();
	}
}

// Re-exportar tipos para facilitar uso
export type { User, Role, Group, Permission, IIdentityManager } from "./types.js";
