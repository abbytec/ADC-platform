import { BaseApp } from "../../BaseApp.js";
import { IIdentityManager, Role } from "../../../services/core/IdentityManagerService/index.js";
import { Logger } from "../../../utils/logger/Logger.js";
import { Action } from "../../../interfaces/behaviours/Actions.js";

interface IdentityTestData {
	userIds: string[];
	roleIds: string[];
	groupIds: string[];
}

/**
 * App que prueba IdentityManagerService con MongoDB.
 */
export default class UserProfileApp extends BaseApp {
	private identityManager!: IIdentityManager;
	private testData: IdentityTestData = {
		userIds: [],
		roleIds: [],
		groupIds: [],
	};

	async start() {
		// Obtener el IdentityManager del kernel
		try {
			this.identityManager = this.kernel.getService<any>("IdentityManagerService");
			Logger.ok(`[${this.name}] IdentityManagerService disponible`);
		} catch (err) {
			Logger.warn(`[${this.name}] IdentityManagerService no disponible: ${err}`);
		}
	}

	async stop() {
		Logger.info(`\n[${this.name}] =============== LIMPIANDO RECURSOS ===============`);
		if (!this.identityManager) {
			Logger.warn(`[${this.name}] IdentityManager no disponible, no se puede limpiar.`);
			return;
		}

		try {
			// Borrar usuarios
			for (const userId of this.testData.userIds) {
				await this.identityManager.users.deleteUser(userId);
				Logger.ok(`[${this.name}] ✓ Usuario eliminado: ${userId}`);
			}

			// Borrar grupos
			for (const groupId of this.testData.groupIds) {
				await this.identityManager.groups.deleteGroup(groupId);
				Logger.ok(`[${this.name}] ✓ Grupo eliminado: ${groupId}`);
			}

			// Borrar roles
			for (const roleId of this.testData.roleIds) {
				await this.identityManager.roles.deleteRole(roleId);
				Logger.ok(`[${this.name}] ✓ Rol eliminado: ${roleId}`);
			}

			this.testData = { userIds: [], roleIds: [], groupIds: [] };
			Logger.ok(`[${this.name}] =============== LIMPIEZA COMPLETADA ===============\n`);
		} catch (error: any) {
			Logger.error(`[${this.name}] Error durante la limpieza: ${error.message}`);
		}
	}

	async run(): Promise<void> {
		Logger.info(`\n[${this.name}] =============== INICIANDO PRUEBA ===============`);

		try {
			if (this.identityManager) {
				await this.#testIdentityManager();
			} else {
				Logger.warn(`[${this.name}] IdentityManager no disponible, saltando pruebas`);
			}

			Logger.ok(`[${this.name}] =============== PRUEBA COMPLETADA ===============\n`);
		} catch (error: any) {
			Logger.error(`[${this.name}] Error durante la ejecución: ${error.message}`);
		}
	}

	/**
	 * Prueba el IdentityManager creando/asociando usuarios, roles y grupos
	 */
	async #testIdentityManager(): Promise<void> {
		Logger.info(`\n[${this.name}] --- Probando IdentityManager ---`);

		try {
			// 1. Crear rol
			const role = await this.#createTestRole();
			this.testData.roleIds.push(role.id);
			Logger.ok(`[${this.name}] ✓ Rol creado: ${role.name}`);

			// 2. Crear grupo
			const group = await this.identityManager.groups.createGroup(`test-group-${Date.now()}`, "Grupo de prueba para user-profile", [
				role.id,
			]);
			this.testData.groupIds.push(group.id);
			Logger.ok(`[${this.name}] ✓ Grupo creado: ${group.name}`);

			// 3. Crear usuario
			const user = await this.identityManager.users.createUser(
				`test-user-${Date.now()}`,
				`pwd-${Math.random().toString(36).substring(7)}`,
				[role.id]
			);
			this.testData.userIds.push(user.id);
			Logger.ok(`[${this.name}] ✓ Usuario creado: ${user.username}`);

			// 4. Asociar usuario con grupo
			await this.identityManager.groups.addUserToGroup(user.id, group.id);
			Logger.ok(`[${this.name}] ✓ Usuario asociado al grupo`);

			// 5. Mostrar estadísticas
			const stats = await this.identityManager.getStats();
			Logger.info(`[${this.name}] Estadísticas de identidad:`);
			Logger.info(`  - Total usuarios: ${stats.totalUsers}`);
			Logger.info(`  - Total roles: ${stats.totalRoles}`);
			Logger.info(`  - Total grupos: ${stats.totalGroups}`);
			Logger.info(`  - Usuario SYSTEM existe: ${stats.systemUserExists}`);

			Logger.ok(`[${this.name}] ✓ IdentityManager test completado`);
		} catch (error: any) {
			Logger.error(`[${this.name}] Error en IdentityManager test: ${error.message}`);
		}
	}

	/**
	 * Crea un rol de prueba
	 */
	async #createTestRole(): Promise<Role> {
		return await this.identityManager.roles.createRole(`test-role-${Date.now()}`, "Rol de prueba para user-profile", [
			{ resource: "user-profile", action: Action.READ, scope: 0xff },
			{ resource: "user-profile", action: Action.WRITE, scope: 0xff },
		]);
	}
}
