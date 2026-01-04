import type { Permission, ResolvedPermission } from "../types.js";
import type { UserManager } from "./users.js";
import type { RoleManager } from "./roles.js";
import type { GroupManager } from "./groups.js";
import type { OrgManager } from "./organizations.js";
import { RESOURCE_NAME, hasFlags } from "../permissions.js";

interface PermissionCacheEntry {
	permissions: ResolvedPermission[];
	timestamp: number;
}

/**
 * LRU Cache simple para permisos
 */
class LRUCache<K, V> {
	#cache = new Map<K, V>();
	#maxSize: number;

	constructor(maxSize: number) {
		this.#maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.#cache.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.#cache.delete(key);
			this.#cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.#cache.has(key)) {
			this.#cache.delete(key);
		} else if (this.#cache.size >= this.#maxSize) {
			// Remove least recently used (first item)
			const firstKey = this.#cache.keys().next().value;
			if (firstKey !== undefined) {
				this.#cache.delete(firstKey);
			}
		}
		this.#cache.set(key, value);
	}

	delete(key: K): boolean {
		return this.#cache.delete(key);
	}

	clear(): void {
		this.#cache.clear();
	}

	keys(): IterableIterator<K> {
		return this.#cache.keys();
	}
}

/**
 * Permisos acumulados por recurso en un nivel de jerarquía
 */
interface LevelPermission {
	action: number;
	scope: number;
}

/**
 * PermissionManager - Gestión de permisos con cache LRU y bitfields
 *
 * Características:
 * - NO persiste permisos (viven en users, groups, roles, orgs)
 * - Cache LRU para permisos resueltos
 * - Jerarquía de override: user → userRoles → groups → groupRoles → org
 *   (niveles superiores reemplazan a inferiores por recurso)
 * - Dentro del mismo nivel: permisos se suman (OR de bitfields)
 * - Actions y Scopes como bitfields numéricos
 */
export class PermissionManager {
	#cache: LRUCache<string, PermissionCacheEntry>;
	#cacheTTL: number;

	constructor(
		private readonly userManager: UserManager,
		private readonly roleManager: RoleManager,
		private readonly groupManager: GroupManager,
		private readonly orgManager?: OrgManager,
		cacheSize: number = 1000,
		cacheTTL: number = 60000 // 1 minuto por defecto
	) {
		this.#cache = new LRUCache(cacheSize);
		this.#cacheTTL = cacheTTL;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Chequeo de permisos
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Verifica si un usuario tiene un permiso específico
	 * @param userId - ID del usuario
	 * @param action - Bitfield de acciones requeridas (Action.READ | Action.WRITE)
	 * @param scope - Bitfield de scope requerido (Scope.USERS | Scope.GROUPS)
	 * @param orgId - ID de organización (opcional)
	 */
	async hasPermission(userId: string, action: number, scope: number, orgId?: string): Promise<boolean> {
		const resolved = await this.resolvePermissions(userId, orgId);
		return this.#checkPermission(resolved, action, scope);
	}

	/**
	 * Resuelve TODOS los permisos de un usuario (con cache)
	 */
	async resolvePermissions(userId: string, orgId?: string): Promise<ResolvedPermission[]> {
		const cacheKey = `${userId}:${orgId || "global"}`;

		// Check cache
		const cached = this.#cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.#cacheTTL) {
			return cached.permissions;
		}

		// Resolver permisos en orden de jerarquía
		const permissions = await this.#resolveHierarchy(userId, orgId);

		// Cache result
		this.#cache.set(cacheKey, { permissions, timestamp: Date.now() });

		return permissions;
	}

	/**
	 * Resuelve la jerarquía completa de permisos
	 * Orden de prioridad (mayor a menor): user → userRoles → groups → groupRoles → org
	 *
	 * - Niveles superiores hacen override de inferiores (por recurso)
	 * - Dentro del mismo nivel, los permisos se suman (OR de bitfields)
	 */
	async #resolveHierarchy(userId: string, orgId?: string): Promise<ResolvedPermission[]> {
		// Permisos finales por recurso: { resource -> { action, scope, source } }
		const finalPerms = new Map<string, { action: number; scope: number; source: ResolvedPermission["source"] }>();

		// Helper: acumula permisos de un nivel (OR dentro del nivel, override entre niveles)
		const applyLevel = (permissions: Permission[], source: ResolvedPermission["source"]) => {
			// Primero acumulamos todos los permisos de este nivel por recurso
			const levelPerms = new Map<string, LevelPermission>();
			for (const perm of permissions) {
				const existing = levelPerms.get(perm.resource);
				if (existing) {
					// Mismo nivel, mismo recurso: sumar (OR)
					existing.action |= perm.action;
					existing.scope |= perm.scope;
				} else {
					levelPerms.set(perm.resource, { action: perm.action, scope: perm.scope });
				}
			}

			// Luego aplicamos override: este nivel reemplaza al anterior para cada recurso
			for (const [resource, perm] of levelPerms) {
				finalPerms.set(resource, { action: perm.action, scope: perm.scope, source });
			}
		};

		// 5. Org permissions (base, menor prioridad)
		if (orgId && this.orgManager) {
			const org = await this.orgManager.getOrganization(orgId);
			if (org?.permissions?.length) {
				applyLevel(org.permissions, "org");
			}
		}

		// Obtener usuario
		const user = await this.userManager.getUser(userId);
		if (!user) return [];

		// Pre-cargar grupos para evitar queries duplicadas
		const groups = await Promise.all((user.groupIds || []).map((gid) => this.groupManager.getGroup(gid)));
		const validGroups = groups.filter((g) => g !== null);

		// 4. Group roles (acumulamos todos los roles de todos los grupos)
		const groupRolePerms: Permission[] = [];
		for (const group of validGroups) {
			for (const roleId of group.roleIds || []) {
				const role = await this.roleManager.getRole(roleId);
				if (role) {
					groupRolePerms.push(...role.permissions);
				}
			}
		}
		if (groupRolePerms.length) {
			applyLevel(groupRolePerms, "groupRole");
		}

		// 3. Group direct permissions (acumulamos de todos los grupos)
		const groupPerms: Permission[] = [];
		for (const group of validGroups) {
			if (group.permissions?.length) {
				groupPerms.push(...group.permissions);
			}
		}
		if (groupPerms.length) {
			applyLevel(groupPerms, "group");
		}

		// 2. User roles (directos + orgMembership)
		const userRolePerms: Permission[] = [];

		// 2b. Roles de orgMembership (si hay orgId)
		if (orgId) {
			const orgMembership = user.orgMemberships?.find((m) => m.orgId === orgId);
			if (orgMembership) {
				for (const roleId of orgMembership.roleIds || []) {
					const role = await this.roleManager.getRole(roleId);
					if (role) {
						userRolePerms.push(...role.permissions);
					}
				}
			}
		}

		// 2a. User roles directos
		for (const roleId of user.roleIds || []) {
			const role = await this.roleManager.getRole(roleId);
			if (role) {
				userRolePerms.push(...role.permissions);
			}
		}
		if (userRolePerms.length) {
			applyLevel(userRolePerms, "userRole");
		}

		// 1. User direct permissions (mayor prioridad)
		if (user.permissions?.length) {
			applyLevel(user.permissions, "user");
		}

		// Convertir a ResolvedPermissions
		const result: ResolvedPermission[] = [];
		for (const [resource, perm] of finalPerms) {
			if (perm.action > 0 && perm.scope > 0) {
				result.push({
					resource,
					action: perm.action,
					scope: perm.scope,
					granted: true,
					source: perm.source,
				});
			}
		}

		return result;
	}

	/**
	 * Verifica si los permisos resueltos cubren las acciones y scope requeridos
	 */
	#checkPermission(resolved: ResolvedPermission[], requiredAction: number, requiredScope: number): boolean {
		for (const perm of resolved) {
			// Solo consideramos permisos del recurso "identity" o permisos que coincidan
			if (perm.resource !== RESOURCE_NAME && perm.resource !== "*") continue;

			if (perm.granted && hasFlags(perm.action, requiredAction) && hasFlags(perm.scope, requiredScope)) {
				return true;
			}
		}
		return false;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Invalidación de cache
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Invalida cache para un usuario específico
	 */
	invalidateUser(userId: string): void {
		for (const key of this.#cache.keys()) {
			if (key.startsWith(`${userId}:`)) {
				this.#cache.delete(key);
			}
		}
	}

	/**
	 * Invalida cache para usuarios de un grupo
	 * Por eficiencia, limpia todo el cache
	 */
	invalidateGroup(_groupId: string): void {
		// Limpiar todo el cache ya que requeriría query para saber qué usuarios afectar
		this.#cache.clear();
	}

	/**
	 * Invalida cache para usuarios con un rol específico
	 * Por eficiencia, limpia todo el cache
	 */
	invalidateRole(_roleId: string): void {
		// Limpiar todo el cache ya que requeriría query para saber qué usuarios afectar
		this.#cache.clear();
	}

	/**
	 * Invalida todo el cache
	 */
	invalidateAll(): void {
		this.#cache.clear();
	}
}
