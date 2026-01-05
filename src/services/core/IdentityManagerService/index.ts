import type { Connection } from "mongoose";
import { BaseService } from "../../BaseService.js";
import type { IdentityStats, OrgScopedManagers } from "./types.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import { userSchema, groupSchema, roleSchema, organizationSchema, regionSchema } from "./domain/index.js";
import { UserManager, GroupManager, RoleManager, PermissionManager, SystemManager, RegionManager, OrgManager } from "./dao/index.js";
import { type IAuthVerifier, type AuthVerifierGetter } from "./utils/auth-verifier.js";
import type SessionManagerService from "../../security/SessionManagerService/index.js";

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
 *
 * **Multi-tenant:**
 * Soporta múltiples organizaciones con bases de datos aisladas.
 * Usa forOrg(slug, mode) para obtener managers con scope de organización.
 *
 * **Autenticación:**
 * Los managers aceptan un parámetro `token` opcional en cada método.
 * Si se proporciona, se verifican los permisos del usuario antes de ejecutar.
 */
export default class IdentityManagerService extends BaseService {
	public readonly name = "IdentityManagerService";

	// Managers globales
	#userManager: UserManager | null = null;
	#roleManager: RoleManager | null = null;
	#groupManager: GroupManager | null = null;
	#systemManager: SystemManager | null = null;
	#regionManager: RegionManager | null = null;
	#orgManager: OrgManager | null = null;
	#permissionManager: PermissionManager | null = null;

	// AuthVerifier para verificar tokens y permisos
	#authVerifier: IAuthVerifier | null = null;

	// MongoDB provider
	#mongoProvider: IMongoProvider | null = null;

	// Cache de conexiones por organización
	#orgConnectionCache: Map<string, { connection: Connection; managers: OrgScopedManagers }> = new Map();

	constructor(kernel: any, options?: any) {
		super(kernel, options);
	}

	/**
	 * Getter para el AuthVerifier (usado por los managers)
	 */
	#getAuthVerifier: AuthVerifierGetter = () => this.#authVerifier;

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		try {
			this.#mongoProvider = this.getMyProvider<IMongoProvider>("object/mongo");

			// Esperar a que MongoDB esté conectado (máximo 10 segundos)
			const maxWaitTime = 10000;
			const startTime = Date.now();
			while (!this.#mongoProvider?.isConnected() && Date.now() - startTime < maxWaitTime) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			if (!this.#mongoProvider?.isConnected()) {
				throw new Error("MongoDB no pudo conectarse en el tiempo esperado");
			}

			// Configurar modelos para la base de datos LOCAL (entidades globales)
			const RegionModel = this.#mongoProvider.createModel("Region", regionSchema);
			const OrganizationModel = this.#mongoProvider.createModel("Organization", organizationSchema);
			const UserModel = this.#mongoProvider.createModel("User", userSchema);
			const RoleModel = this.#mongoProvider.createModel("Role", roleSchema);
			const GroupModel = this.#mongoProvider.createModel("Group", groupSchema);

			// Inicializar RegionManager PRIMERO (necesario para OrgManager)
			this.#regionManager = new RegionManager(RegionModel, this.logger);
			await this.#regionManager.initialize();

			// Inicializar otros managers con el getter de AuthVerifier
			this.#orgManager = new OrgManager(OrganizationModel, this.#regionManager, this.logger);
			this.#userManager = new UserManager(UserModel, this.logger, this.#getAuthVerifier);
			this.#roleManager = new RoleManager(RoleModel, this.logger, this.#getAuthVerifier);
			this.#groupManager = new GroupManager(GroupModel, UserModel, this.logger, this.#getAuthVerifier);
			this.#systemManager = new SystemManager(UserModel, RoleModel, GroupModel, this.logger, kernelKey);

			// Inicializar roles predefinidos y usuario SYSTEM en BD local
			await this.#roleManager.initializePredefinedRoles();
			await this.#systemManager.initializeSystemUser();

			// Inicializar PermissionManager con cache LRU
			this.#permissionManager = new PermissionManager(
				this.#userManager,
				this.#roleManager,
				this.#groupManager,
				this.#orgManager,
				1000, // cache size
				60000 // TTL 1 minuto
			);

			// Crear el AuthVerifier ahora que tenemos todos los componentes
			this.#authVerifier = this.#createAuthVerifier();

			this.logger.logOk("IdentityManagerService iniciado con soporte multi-tenant y autenticación");
		} catch (error: any) {
			this.logger.logError("MongoDB no está disponible. IdentityManagerService requiere MongoDB.");
			throw new Error(`IdentityManagerService requiere MongoDB: ${error.message}`);
		}
	}

	/**
	 * Crea el AuthVerifier que usa SessionManagerService y PermissionManager
	 */
	#createAuthVerifier(): IAuthVerifier {
		return {
			verifyToken: async (token: string) => {
				let sessionService: SessionManagerService;
				try {
					sessionService = this.kernel.getService<SessionManagerService>("SessionManagerService");
				} catch {
					return { valid: false, error: "SessionManagerService no disponible" };
				}

				const result = await sessionService.verifyToken(token);
				if (!result.valid || !result.session) {
					return { valid: false, error: result.error || "Token inválido" };
				}

				return { valid: true, userId: result.session.user.id };
			},

			hasPermission: async (userId: string, action: number, scope: number, orgId?: string) => {
				if (!this.#permissionManager) {
					return false;
				}
				return this.#permissionManager.hasPermission(userId, action, scope, orgId);
			},
		};
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Getters para acceso a managers globales
	// ─────────────────────────────────────────────────────────────────────────────

	get users(): UserManager {
		if (!this.#userManager) throw new Error("UserManager not initialized");
		return this.#userManager;
	}

	get roles(): RoleManager {
		if (!this.#roleManager) throw new Error("RoleManager not initialized");
		return this.#roleManager;
	}

	get groups(): GroupManager {
		if (!this.#groupManager) throw new Error("GroupManager not initialized");
		return this.#groupManager;
	}

	get system(): SystemManager {
		if (!this.#systemManager) throw new Error("SystemManager not initialized");
		return this.#systemManager;
	}

	get organizations(): OrgManager {
		if (!this.#orgManager) throw new Error("OrgManager not initialized");
		return this.#orgManager;
	}

	get regions(): RegionManager {
		if (!this.#regionManager) throw new Error("RegionManager not initialized");
		return this.#regionManager;
	}

	get permissions(): PermissionManager {
		if (!this.#permissionManager) throw new Error("PermissionManager not initialized");
		return this.#permissionManager;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Operaciones con scope de organización
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Obtiene managers con scope de organización
	 *
	 * @param orgIdOrSlug - ID o slug de la organización
	 * @param mode - "write" usa región global, "read" puede usar réplica local
	 * @returns Managers para operar dentro de la organización
	 */
	async forOrg(orgIdOrSlug: string, mode: "read" | "write" = "write"): Promise<OrgScopedManagers> {
		const org = await this.#orgManager!.getOrganization(orgIdOrSlug);
		if (!org) {
			throw new Error(`Organización no encontrada: ${orgIdOrSlug}`);
		}

		if (org.status !== "active") {
			throw new Error(`Organización ${org.status}: ${orgIdOrSlug}`);
		}

		// Generar cache key que incluye el modo
		const cacheKey = `${org.orgId}:${mode}`;

		// Verificar cache
		const cached = this.#orgConnectionCache.get(cacheKey);
		if (cached) {
			return cached.managers;
		}

		// Determinar qué región usar según el modo
		let connectionUri: string | null;

		if (mode === "write") {
			// Escrituras siempre van a la región global
			const globalRegion = await this.#regionManager!.getGlobalRegion();
			connectionUri = globalRegion.metadata.objectConnectionUri || null;
		} else {
			// Lecturas pueden usar la réplica local de la org
			connectionUri = this.#regionManager!.getObjectConnectionUri(org.region);
		}

		if (!connectionUri) {
			throw new Error(`No hay connectionUri configurado para región: ${org.region}`);
		}

		// Obtener/crear conexión
		const regionConnection = await this.#mongoProvider!.getOrCreateConnection(connectionUri);

		// Cambiar a la base de datos de la organización
		const dbName = this.#orgManager!.getDbName(org);
		const orgDbConnection = this.#mongoProvider!.useDb(regionConnection, dbName);

		// Crear modelos para la base de datos de la organización
		const OrgUserModel = this.#mongoProvider!.createModelForDb(orgDbConnection, "User", userSchema);
		const OrgRoleModel = this.#mongoProvider!.createModelForDb(orgDbConnection, "Role", roleSchema);
		const OrgGroupModel = this.#mongoProvider!.createModelForDb(orgDbConnection, "Group", groupSchema);

		// Crear managers con scope de organización (con AuthVerifier)
		const orgUserManager = new UserManager(OrgUserModel, this.logger, this.#getAuthVerifier);
		const orgRoleManager = new RoleManager(OrgRoleModel, this.logger, this.#getAuthVerifier);
		const orgGroupManager = new GroupManager(OrgGroupModel, OrgUserModel, this.logger, this.#getAuthVerifier);

		const managers: OrgScopedManagers = {
			org,
			users: orgUserManager,
			roles: orgRoleManager,
			groups: orgGroupManager,

			// Inicializa la base de datos de la org (roles predefinidos, etc.)
			initialize: async () => {
				await orgRoleManager.initializePredefinedRoles();
				this.logger.logOk(`[IdentityManager] Base de datos inicializada para org: ${org.slug}`);
			},
		};

		// Cachear
		this.#orgConnectionCache.set(cacheKey, {
			connection: orgDbConnection,
			managers,
		});

		return managers;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Métodos de servicio
	// ─────────────────────────────────────────────────────────────────────────────

	async getStats(): Promise<IdentityStats> {
		const baseStats = await this.#systemManager!.getStats();
		const orgs = await this.#orgManager!.getAllOrganizations();
		const regions = await this.#regionManager!.getAllRegions();

		return {
			...baseStats,
			totalOrganizations: orgs.length,
			totalRegions: regions.length,
		};
	}

	async stop(kernelKey: symbol): Promise<void> {
		// Limpiar cache de conexiones por organización
		this.#orgConnectionCache.clear();

		await super.stop(kernelKey);
		this.#systemManager?.clearSystemUser(kernelKey);
		this.#authVerifier = null;

		this.logger.logOk("IdentityManagerService detenido");
	}
}

// Re-exportar tipos para facilitar uso
export type { OrgScopedManagers } from "./types.js";
export type { IdentityManagerService as IIdentityManager };
export type { User, Role, Group, Permission, Organization, RegionInfo } from "./domain/index.js";
// Re-exportar SystemRole para compatibilidad
export { SystemRole } from "./defaults/systemRoles.js";
// Re-exportar AuthorizationError
export { AuthorizationError } from "./utils/auth-verifier.js";
export { type IAuthVerifier } from "./utils/auth-verifier.js";
