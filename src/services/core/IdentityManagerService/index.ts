import type { Connection } from "mongoose";
import { BaseService } from "../../BaseService.js";
import type { IdentityStats, OrgScopedManagers } from "./types.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import { UserManager, userSchema } from "./domain/users.js";
import { RoleManager, roleSchema } from "./domain/roles.js";
import { GroupManager, groupSchema } from "./domain/groups.js";
import { SystemManager } from "./domain/system.js";
import { RegionManager, regionSchema } from "./domain/regions.js";
import { OrgManager, organizationSchema } from "./domain/organizations.js";
import { PermissionManager } from "./domain/permissions.js";

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
 *
 * **Multi-tenant:**
 * Soporta múltiples organizaciones con bases de datos aisladas.
 * Usa forOrg(slug, mode) para obtener managers con scope de organización.
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

	// MongoDB provider
	#mongoProvider: IMongoProvider | null = null;

	// Cache de conexiones por organización
	#orgConnectionCache: Map<string, { connection: Connection; managers: OrgScopedManagers }> = new Map();

	constructor(kernel: any, options?: any) {
		super(kernel, options);
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		try {
			this.#mongoProvider = this.kernel.getProvider<IMongoProvider>("mongo");

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

			// Inicializar otros managers
			this.#orgManager = new OrgManager(OrganizationModel, this.#regionManager, this.logger);
			this.#userManager = new UserManager(UserModel, this.logger);
			this.#roleManager = new RoleManager(RoleModel, this.logger);
			this.#groupManager = new GroupManager(GroupModel, UserModel, this.logger);
			this.#systemManager = new SystemManager(UserModel, RoleModel, GroupModel, this.logger);

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

			this.logger.logOk("IdentityManagerService iniciado con soporte multi-tenant");
		} catch (error: any) {
			this.logger.logError("MongoDB no está disponible. IdentityManagerService requiere MongoDB.");
			throw new Error(`IdentityManagerService requiere MongoDB: ${error.message}`);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Getters para acceso a managers globales
	// ─────────────────────────────────────────────────────────────────────────────

	get users(): UserManager {
		if (!this.#userManager) throw new Error("IdentityManagerService not initialized");
		return this.#userManager;
	}

	get roles(): RoleManager {
		if (!this.#roleManager) throw new Error("IdentityManagerService not initialized");
		return this.#roleManager;
	}

	get groups(): GroupManager {
		if (!this.#groupManager) throw new Error("IdentityManagerService not initialized");
		return this.#groupManager;
	}

	get system(): SystemManager {
		if (!this.#systemManager) throw new Error("IdentityManagerService not initialized");
		return this.#systemManager;
	}

	get organizations(): OrgManager {
		if (!this.#orgManager) throw new Error("IdentityManagerService not initialized");
		return this.#orgManager;
	}

	get regions(): RegionManager {
		if (!this.#regionManager) throw new Error("IdentityManagerService not initialized");
		return this.#regionManager;
	}

	get permissions(): PermissionManager {
		if (!this.#permissionManager) throw new Error("IdentityManagerService not initialized");
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

		// Crear managers con scope de organización
		const orgUserManager = new UserManager(OrgUserModel, this.logger);
		const orgRoleManager = new RoleManager(OrgRoleModel, this.logger);
		const orgGroupManager = new GroupManager(OrgGroupModel, OrgUserModel, this.logger);

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
		this.#systemManager?.clearSystemUser();

		this.logger.logOk("IdentityManagerService detenido");
	}
}

// Re-exportar tipos para facilitar uso
export type { User, Role, Group, Permission, Organization, RegionInfo, OrgScopedManagers } from "./types.js";
export type { IdentityManagerService as IIdentityManager };
