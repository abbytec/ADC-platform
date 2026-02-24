import type { Model } from "mongoose";
import type { User } from "../domain/user.ts";
import type { ILogger } from "../../../../interfaces/utils/ILogger.js";
import { generateId, hashPassword, verifyPassword } from "../utils/crypto.ts";
import { type AuthVerifierGetter, PermissionChecker } from "../utils/auth-verifier.ts";
import { IdentityScope } from "@common/types/identity.js";
import { CRUDXAction } from "@common/types/Actions.ts";

export type UserAuthenticationResult = Partial<User> | { id: string; isActive: boolean } | { id: string; wrongPassword: boolean } | null;

export class UserManager {
	#permissionChecker: PermissionChecker;

	constructor(
		private readonly userModel: Model<any>,
		private readonly logger: ILogger,
		getAuthVerifier: AuthVerifierGetter = () => null
	) {
		this.#permissionChecker = new PermissionChecker(getAuthVerifier, "UserManager");
	}

	/**
	 * Autentica un usuario con username y password
	 * No requiere token (es el proceso de login)
	 */
	async authenticate(username: string, password: string): Promise<UserAuthenticationResult> {
		try {
			const doc = await this.userModel.findOne({ username });
			const user: User | null = doc?.toObject?.() || doc || null;

			if (!user) return null;

			if (!user?.isActive) return { id: user.id, isActive: false };

			const valid = verifyPassword(password, user.passwordHash);
			if (!valid) return { id: user.id, wrongPassword: true };

			user.lastLogin = new Date();
			await this.userModel.findOneAndUpdate({ id: user.id }, { lastLogin: user.lastLogin });

			return user;
		} catch (error) {
			this.logger.logError(`Error autenticando usuario: ${error}`);
			return null;
		}
	}

	/**
	 * Crea un nuevo usuario
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async createUser(username: string, password: string, roleIds?: string[], token?: string): Promise<User> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScope.USERS);
		}

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

	/**
	 * Obtiene un usuario por ID
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getUser(userId: string, token?: string): Promise<User | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const doc = await this.userModel.findOne({ id: userId });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo usuario: ${error}`);
			return null;
		}
	}

	/**
	 * Obtiene un usuario por username
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getUserByUsername(username: string, token?: string): Promise<User | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const doc = await this.userModel.findOne({ username });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo usuario por username: ${error}`);
			return null;
		}
	}

	/**
	 * Obtiene un usuario por email
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getUserByEmail(email: string, token?: string): Promise<User | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const doc = await this.userModel.findOne({ email });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error obteniendo usuario por email: ${error}`);
			return null;
		}
	}

	/**
	 * Verifica si existe un usuario con el username O email dados (una sola query)
	 * Retorna cuál campo ya existe para dar feedback específico
	 */
	async existsByUsernameOrEmail(username: string, email: string, token?: string): Promise<{ exists: boolean; field?: "username" | "email" }> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const doc = await this.userModel.findOne({ $or: [{ username }, { email }] });
			if (!doc) return { exists: false };

			const user = doc.toObject?.() || doc;
			if (user.username === username) return { exists: true, field: "username" };
			return { exists: true, field: "email" };
		} catch (error) {
			this.logger.logError(`Error verificando existencia de usuario: ${error}`);
			return { exists: false };
		}
	}

	/**
	 * Busca usuario por providerId en metadata O por email (query optimizada)
	 * Útil para login OAuth donde el usuario puede existir por provider previo o por email
	 */
	async findByProviderIdOrEmail(providerIdField: string, providerId: string, email?: string, token?: string): Promise<User | null> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const conditions: any[] = [{ [`metadata.${providerIdField}`]: providerId }];
			if (email) {
				conditions.push({ email });
			}
			const doc = await this.userModel.findOne({ $or: conditions });
			return doc?.toObject?.() || doc || null;
		} catch (error) {
			this.logger.logError(`Error buscando usuario por provider o email: ${error}`);
			return null;
		}
	}

	/**
	 * Actualiza un usuario
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async updateUser(userId: string, updates: Partial<User>, token?: string): Promise<User> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.UPDATE, IdentityScope.USERS);
		}

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

	/**
	 * Elimina un usuario
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async deleteUser(userId: string, token?: string): Promise<void> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScope.USERS);
		}

		try {
			await this.userModel.deleteOne({ id: userId });
			this.logger.logDebug(`Usuario eliminado: ${userId}`);
		} catch (error) {
			this.logger.logError(`Error eliminando usuario: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene todos los usuarios, opcionalmente filtrados por orgId
	 * @param token Token de autenticación (requerido para verificar permisos)
	 * @param orgId Si se proporciona, filtra usuarios que pertenecen a esta organización
	 */
	async getAllUsers(token?: string, orgId?: string): Promise<User[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const filter = orgId ? { "orgMemberships.orgId": orgId } : {};
			const docs = await this.userModel.find(filter);
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error obteniendo usuarios: ${error}`);
			return [];
		}
	}

	/**
	 * Busca usuarios por username o email (parcial, case-insensitive)
	 * @param query Texto a buscar
	 * @param limit Máximo de resultados (default 10)
	 * @param token Token de autenticación
	 * @param orgId Si se proporciona, filtra usuarios que pertenecen a esta organización
	 */
	async searchUsers(query: string, limit: number = 10, token?: string, orgId?: string): Promise<User[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS);
		}

		try {
			const escapedQuery = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
			const regex = new RegExp(escapedQuery, "i");
			const filter: any = { $or: [{ username: regex }, { email: regex }] };
			if (orgId) filter["orgMemberships.orgId"] = orgId;
			const docs = await this.userModel.find(filter).limit(limit);
			return docs.map((d: any) => d.toObject?.() || d);
		} catch (error) {
			this.logger.logError(`Error buscando usuarios: ${error}`);
			return [];
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Métodos de membresía por organización
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Agrega membresía a una organización
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async addOrgMembership(userId: string, orgId: string, roleIds: string[] = [], token?: string): Promise<User> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.WRITE, IdentityScope.USERS | IdentityScope.ORGANIZATIONS, orgId);
		}

		try {
			const updated = await this.userModel.findOneAndUpdate(
				{ id: userId },
				{
					$addToSet: {
						orgMemberships: { orgId, roleIds, joinedAt: new Date() },
					},
					updatedAt: new Date(),
				},
				{ new: true }
			);
			if (!updated) throw new Error(`Usuario ${userId} no encontrado`);
			this.logger.logDebug(`Usuario ${userId} agregado a organización ${orgId}`);
			return updated.toObject?.() || updated;
		} catch (error) {
			this.logger.logError(`Error agregando membresía de organización: ${error}`);
			throw error;
		}
	}

	/**
	 * Remueve membresía de una organización
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async removeOrgMembership(userId: string, orgId: string, token?: string): Promise<User> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.DELETE, IdentityScope.USERS | IdentityScope.ORGANIZATIONS, orgId);
		}

		try {
			const updated = await this.userModel.findOneAndUpdate(
				{ id: userId },
				{
					$pull: { orgMemberships: { orgId } },
					updatedAt: new Date(),
				},
				{ new: true }
			);
			if (!updated) throw new Error(`Usuario ${userId} no encontrado`);
			this.logger.logDebug(`Usuario ${userId} removido de organización ${orgId}`);
			return updated.toObject?.() || updated;
		} catch (error) {
			this.logger.logError(`Error removiendo membresía de organización: ${error}`);
			throw error;
		}
	}

	/**
	 * Obtiene las organizaciones de un usuario
	 * @param token Token de autenticación (requerido para verificar permisos)
	 */
	async getUserOrganizations(userId: string, token?: string): Promise<string[]> {
		if (token) {
			await this.#permissionChecker.requirePermission(token, CRUDXAction.READ, IdentityScope.USERS | IdentityScope.ORGANIZATIONS);
		}

		try {
			const user = await this.userModel.findOne({ id: userId });
			if (!user) return [];
			return user.orgMemberships?.map((m: any) => m.orgId) || [];
		} catch (error) {
			this.logger.logError(`Error obteniendo organizaciones del usuario: ${error}`);
			return [];
		}
	}
}
