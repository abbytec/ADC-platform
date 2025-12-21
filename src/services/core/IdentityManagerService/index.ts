import { BaseService } from "../../BaseService.js";
import type { Permission, Role, Group, User, IIdentityManager } from "./types.js";
import { UserManager, userSchema } from "./domain/users.js";
import { RoleManager, roleSchema } from "./domain/roles.js";
import { GroupManager, groupSchema } from "./domain/groups.js";
import { SystemManager } from "./domain/system.js";

// Re-exportar SystemRole para compatibilidad
export { SystemRole } from "./domain/roles.js";

/**
 * IdentityManagerService - Gestión centralizada de identidades, usuarios, roles y grupos
 *
 * **Modo Kernel:**
 * Este servicio se ejecuta en modo kernel (global: true en config.json),
 * lo que significa que está disponible para toda la plataforma.
 *
 * **Persistencia:**
 * Requiere MongoDB para persistir datos. Si no hay un MongoProvider configurado,
 * el servicio lanzará un error.
 */
export default class IdentityManagerService extends BaseService implements IIdentityManager {
	public readonly name = "IdentityManagerService";

	#userManager: UserManager | null = null;
	#roleManager: RoleManager | null = null;
	#groupManager: GroupManager | null = null;
	#systemManager: SystemManager | null = null;

	constructor(kernel: any, options?: any) {
		super(kernel, options);
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		try {
			const mongoInstance = this.kernel.getProvider<any>("mongo");

			// Esperar a que MongoDB esté conectado (máximo 10 segundos)
			const maxWaitTime = 10000;
			const startTime = Date.now();
			while (!mongoInstance?.isConnected() && Date.now() - startTime < maxWaitTime) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			if (!mongoInstance?.isConnected()) {
				throw new Error("MongoDB no pudo conectarse en el tiempo esperado");
			}

			// Configurar modelos
			const UserModel = mongoInstance.createModel("User", userSchema);
			const RoleModel = mongoInstance.createModel("Role", roleSchema);
			const GroupModel = mongoInstance.createModel("Group", groupSchema);

			// Inicializar managers
			this.#userManager = new UserManager(UserModel, this.logger);
			this.#roleManager = new RoleManager(RoleModel, this.logger);
			this.#groupManager = new GroupManager(GroupModel, UserModel, this.logger);
			this.#systemManager = new SystemManager(UserModel, RoleModel, GroupModel, this.logger);

			// Inicializar roles predefinidos y usuario SYSTEM
			await this.#roleManager.initializePredefinedRoles();
			await this.#systemManager.initializeSystemUser();

			this.logger.logOk("IdentityManagerService iniciado con MongoDB");
		} catch (error: any) {
			this.logger.logError("MongoDB no está disponible. IdentityManagerService requiere MongoDB.");
			throw new Error(`IdentityManagerService requiere MongoDB: ${error.message}`);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Métodos públicos de IIdentityManager (delegados a managers)
	// ─────────────────────────────────────────────────────────────────────────────

	async authenticate(username: string, password: string): Promise<User | null> {
		return this.#userManager!.authenticate(username, password);
	}

	async createUser(username: string, password: string, roleIds?: string[]): Promise<User> {
		return this.#userManager!.createUser(username, password, roleIds);
	}

	async getUser(userId: string): Promise<User | null> {
		return this.#userManager!.getUser(userId);
	}

	async getUserByUsername(username: string): Promise<User | null> {
		return this.#userManager!.getUserByUsername(username);
	}

	async updateUser(userId: string, updates: Partial<User>): Promise<User> {
		return this.#userManager!.updateUser(userId, updates);
	}

	async deleteUser(userId: string): Promise<void> {
		return this.#userManager!.deleteUser(userId);
	}

	async getAllUsers(): Promise<User[]> {
		return this.#userManager!.getAllUsers();
	}

	async createRole(name: string, description: string, permissions?: Permission[]): Promise<Role> {
		return this.#roleManager!.createRole(name, description, permissions);
	}

	async getRole(roleId: string): Promise<Role | null> {
		return this.#roleManager!.getRole(roleId);
	}

	async deleteRole(roleId: string): Promise<void> {
		return this.#roleManager!.deleteRole(roleId);
	}

	async getAllRoles(): Promise<Role[]> {
		return this.#roleManager!.getAllRoles();
	}

	async getPredefinedRoles(): Promise<Role[]> {
		return this.#roleManager!.getPredefinedRoles();
	}

	async createGroup(name: string, description: string, roleIds?: string[]): Promise<Group> {
		return this.#groupManager!.createGroup(name, description, roleIds);
	}

	async getGroup(groupId: string): Promise<Group | null> {
		return this.#groupManager!.getGroup(groupId);
	}

	async deleteGroup(groupId: string): Promise<void> {
		return this.#groupManager!.deleteGroup(groupId);
	}

	async getAllGroups(): Promise<Group[]> {
		return this.#groupManager!.getAllGroups();
	}

	async addUserToGroup(userId: string, groupId: string): Promise<void> {
		return this.#groupManager!.addUserToGroup(userId, groupId);
	}

	async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
		return this.#groupManager!.removeUserFromGroup(userId, groupId);
	}

	async getSystemUser(): Promise<User> {
		return this.#systemManager!.getSystemUser();
	}

	async getStats(): Promise<{
		totalUsers: number;
		totalRoles: number;
		totalGroups: number;
		systemUserExists: boolean;
	}> {
		return this.#systemManager!.getStats();
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		this.#systemManager?.clearSystemUser();
	}
}

// Re-exportar tipos para facilitar uso
export type { User, Role, Group, Permission, IIdentityManager } from "./types.js";
