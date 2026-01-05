import { BaseApp } from "../../BaseApp.js";
import type IdentityManagerService from "../../../services/core/IdentityManagerService/index.js";
import { AuthorizationError } from "../../../services/core/IdentityManagerService/index.js";
import type { Role, User } from "../../../services/core/IdentityManagerService/types.js";
import type SessionManagerService from "../../../services/security/SessionManagerService/index.js";
import { Logger } from "../../../utils/logger/Logger.js";
import { Action } from "../../../interfaces/behaviours/Actions.js";
import { Scope } from "../../../services/core/IdentityManagerService/permissions.js";

interface IdentityTestData {
	userIds: string[];
	roleIds: string[];
	groupIds: string[];
}

/**
 * App que prueba IdentityManagerService con MongoDB y autenticación.
 * Prueba el flujo completo: login, tokens, permisos y operaciones autenticadas.
 *
 * Usa el usuario SYSTEM para operaciones privilegiadas.
 */
export default class UserProfileApp extends BaseApp {
	private identityManager!: IdentityManagerService;
	private sessionManager!: SessionManagerService;
	#systemUser: User | null = null;
	private testData: IdentityTestData = {
		userIds: [],
		roleIds: [],
		groupIds: [],
	};

	async start(kernelKey: symbol) {
		this.identityManager = this.kernel.getService<IdentityManagerService>("IdentityManagerService");
		this.sessionManager = this.kernel.getService<SessionManagerService>("SessionManagerService");
		this.#systemUser = await this.identityManager.system.getSystemUser(kernelKey);
	}

	async stop() {
		Logger.info(`\n[${this.name}] =============== LIMPIANDO RECURSOS ===============`);
		if (!this.identityManager) {
			Logger.warn(`[${this.name}] IdentityManager no disponible, no se puede limpiar.`);
			return;
		}

		try {
			// Borrar usuarios (en orden inverso para evitar dependencias)
			for (const userId of [...this.testData.userIds].reverse()) {
				try {
					await this.identityManager.users.deleteUser(userId);
					Logger.ok(`[${this.name}] ✓ Usuario eliminado: ${userId}`);
				} catch (e: any) {
					Logger.warn(`[${this.name}] No se pudo eliminar usuario ${userId}: ${e.message}`);
				}
			}

			// Borrar grupos
			for (const groupId of this.testData.groupIds) {
				try {
					await this.identityManager.groups.deleteGroup(groupId);
					Logger.ok(`[${this.name}] ✓ Grupo eliminado: ${groupId}`);
				} catch (e: any) {
					Logger.warn(`[${this.name}] No se pudo eliminar grupo ${groupId}: ${e.message}`);
				}
			}

			// Borrar roles
			for (const roleId of this.testData.roleIds) {
				try {
					await this.identityManager.roles.deleteRole(roleId);
					Logger.ok(`[${this.name}] ✓ Rol eliminado: ${roleId}`);
				} catch (e: any) {
					Logger.warn(`[${this.name}] No se pudo eliminar rol ${roleId}: ${e.message}`);
				}
			}

			this.testData = { userIds: [], roleIds: [], groupIds: [] };
			Logger.ok(`[${this.name}] =============== LIMPIEZA COMPLETADA ===============\n`);
		} catch (error: any) {
			Logger.error(`[${this.name}] Error durante la limpieza: ${error.message}`);
		}
	}

	async run(): Promise<void> {
		Logger.info(`\n[${this.name}] =============== INICIANDO PRUEBAS ===============`);

		try {
			if (!this.identityManager) {
				Logger.warn(`[${this.name}] IdentityManager no disponible, saltando pruebas`);
				return;
			}

			// Test básico sin autenticación
			await this.#testBasicOperations();

			// Test con autenticación y permisos (solo si SessionManager está disponible)
			if (this.sessionManager) {
				await this.#testAuthenticatedOperations();
			} else {
				Logger.warn(`[${this.name}] SessionManager no disponible, saltando pruebas de auth`);
			}

			Logger.ok(`[${this.name}] =============== PRUEBAS COMPLETADAS ===============\n`);
		} catch (error: any) {
			Logger.error(`[${this.name}] Error durante la ejecución: ${error.message}`);
			Logger.error(error.stack);
		}
	}

	/**
	 * Prueba operaciones básicas sin autenticación (token no proporcionado)
	 */
	async #testBasicOperations(): Promise<void> {
		Logger.info(`\n[${this.name}] --- Test: Operaciones Básicas (sin token) ---`);

		// 1. Crear rol de prueba
		const role = await this.#createTestRole("basic");
		this.testData.roleIds.push(role.id);
		Logger.ok(`[${this.name}] ✓ Rol creado: ${role.name}`);

		// 2. Crear grupo
		const group = await this.identityManager.groups.createGroup(`test-group-${Date.now()}`, "Grupo de prueba básico", [role.id]);
		this.testData.groupIds.push(group.id);
		Logger.ok(`[${this.name}] ✓ Grupo creado: ${group.name}`);

		// 3. Crear usuario
		const user = await this.identityManager.users.createUser(`test-user-${Date.now()}`, `pwd-${Math.random().toString(36).slice(-8)}`, [
			role.id,
		]);
		this.testData.userIds.push(user.id);
		Logger.ok(`[${this.name}] ✓ Usuario creado: ${user.username}`);

		// 4. Asociar usuario con grupo
		await this.identityManager.groups.addUserToGroup(user.id, group.id);
		Logger.ok(`[${this.name}] ✓ Usuario asociado al grupo`);

		// 5. Verificar permisos
		const hasReadPerm = await this.identityManager.permissions.hasPermission(user.id, Action.READ, Scope.SELF);
		Logger.info(`[${this.name}]   Usuario tiene permiso READ.SELF: ${hasReadPerm}`);

		// 6. Estadísticas
		const stats = await this.identityManager.getStats();
		Logger.info(`[${this.name}] Estadísticas:`);
		Logger.info(`  - Usuarios: ${stats.totalUsers}, Roles: ${stats.totalRoles}, Grupos: ${stats.totalGroups}`);

		Logger.ok(`[${this.name}] ✓ Test básico completado`);
	}

	/**
	 * Prueba operaciones con autenticación y verificación de permisos
	 * Usa el usuario SYSTEM que tiene todos los permisos
	 */
	async #testAuthenticatedOperations(): Promise<void> {
		Logger.info(`\n[${this.name}] --- Test: Operaciones Autenticadas (con token) ---`);

		// Obtener JWT provider para generar tokens
		const jwtProvider = this.kernel.getProvider<any>("jwt");

		// 1. Obtener el usuario SYSTEM (tiene todos los permisos)
		// REQUIERE kernelKey - solo apps con acceso al kernel pueden obtener el usuario SYSTEM

		Logger.ok(`[${this.name}] ✓ Usuario SYSTEM obtenido: ${this.#systemUser!.username}`);

		// 2. Generar token para el usuario SYSTEM
		const systemToken = await jwtProvider.encrypt({
			userId: this.#systemUser!.id,
			permissions: [`identity.${Scope.ALL}.${Action.ALL}`],
		});
		Logger.ok(`[${this.name}] ✓ Token SYSTEM generado`);

		// 3. Crear rol con permisos limitados (solo lectura)
		const limitedRole = await this.identityManager.roles.createRole(`limited-role-${Date.now()}`, "Rol con permisos limitados", [
			{ resource: "identity", action: Action.READ, scope: Scope.USERS },
		]);
		this.testData.roleIds.push(limitedRole.id);
		Logger.ok(`[${this.name}] ✓ Rol limitado creado: ${limitedRole.name}`);

		// 4. Crear usuario con permisos limitados
		const limitedPassword = `limited-pwd-${Math.random().toString(36).slice(-8)}`;
		const limitedUser = await this.identityManager.users.createUser(`limited-${Date.now()}`, limitedPassword, [limitedRole.id]);
		this.testData.userIds.push(limitedUser.id);
		Logger.ok(`[${this.name}] ✓ Usuario limitado creado: ${limitedUser.username}`);

		// 5. Generar token para el usuario limitado
		const limitedToken = await jwtProvider.encrypt({
			userId: limitedUser.id,
			permissions: [`identity.${Scope.USERS}.${Action.READ}`],
		});
		Logger.ok(`[${this.name}] ✓ Token limitado generado`);

		// 6. Test: SYSTEM puede crear usuarios pasando token como parámetro
		Logger.info(`[${this.name}] Probando operaciones con token SYSTEM...`);
		try {
			const newUser = await this.identityManager.users.createUser(
				`created-by-system-${Date.now()}`,
				"temp-password",
				[],
				systemToken // Token como último parámetro
			);
			this.testData.userIds.push(newUser.id);
			Logger.ok(`[${this.name}] ✓ SYSTEM pudo crear usuario: ${newUser.username}`);

			// SYSTEM puede leer usuarios
			const allUsers = await this.identityManager.users.getAllUsers(systemToken);
			Logger.ok(`[${this.name}] ✓ SYSTEM pudo listar ${allUsers.length} usuarios`);
		} catch (error: any) {
			Logger.error(`[${this.name}] ✗ Error con token SYSTEM: ${error.message}`);
		}

		// 7. Test: Usuario limitado puede leer pero NO puede crear
		Logger.info(`[${this.name}] Probando restricciones con token limitado...`);
		try {
			// Usuario limitado puede leer (tiene permiso READ)
			const users = await this.identityManager.users.getAllUsers(limitedToken);
			Logger.ok(`[${this.name}] ✓ Usuario limitado pudo listar ${users.length} usuarios (tiene READ)`);

			// Usuario limitado NO puede crear (no tiene permiso WRITE)
			try {
				await this.identityManager.users.createUser(`should-fail-${Date.now()}`, "temp", [], limitedToken);
				Logger.error(`[${this.name}] ✗ Usuario limitado pudo crear (NO debería poder)`);
			} catch (authError: any) {
				if (authError instanceof AuthorizationError) {
					Logger.ok(`[${this.name}] ✓ Usuario limitado bloqueado correctamente para WRITE: ${authError.code}`);
				} else {
					throw authError;
				}
			}

			// Usuario limitado NO puede eliminar
			try {
				await this.identityManager.users.deleteUser(limitedUser.id, limitedToken);
				Logger.error(`[${this.name}] ✗ Usuario limitado pudo eliminar (NO debería poder)`);
			} catch (authError: any) {
				if (authError instanceof AuthorizationError) {
					Logger.ok(`[${this.name}] ✓ Usuario limitado bloqueado correctamente para DELETE: ${authError.code}`);
				} else {
					throw authError;
				}
			}
		} catch (error: any) {
			if (error instanceof AuthorizationError) {
				Logger.ok(`[${this.name}] ✓ Operación bloqueada correctamente: ${error.message}`);
			} else {
				Logger.error(`[${this.name}] ✗ Error inesperado: ${error.message}`);
				Logger.error(error.stack);
			}
		}

		// 8. Test: Token inválido debe fallar
		Logger.info(`[${this.name}] Probando token inválido...`);
		try {
			await this.identityManager.users.getAllUsers("invalid-token-12345");
			Logger.error(`[${this.name}] ✗ Token inválido fue aceptado (NO debería)`);
		} catch (error: any) {
			if (error instanceof AuthorizationError) {
				Logger.ok(`[${this.name}] ✓ Token inválido rechazado correctamente: ${error.code}`);
			} else {
				Logger.ok(`[${this.name}] ✓ Token inválido rechazado: ${error.message}`);
			}
		}

		Logger.ok(`[${this.name}] ✓ Test de autenticación completado`);
	}

	/**
	 * Crea un rol de prueba con permisos básicos
	 */
	async #createTestRole(prefix: string): Promise<Role> {
		return await this.identityManager.roles.createRole(`${prefix}-role-${Date.now()}`, `Rol de prueba ${prefix}`, [
			{ resource: "user-profile", action: Action.READ, scope: Scope.SELF },
			{ resource: "user-profile", action: Action.WRITE, scope: Scope.SELF },
		]);
	}
}
