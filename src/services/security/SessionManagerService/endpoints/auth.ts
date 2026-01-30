import type { KeyStore } from "../domain/keys/KeyStore.js";
import type { TokenService } from "../domain/tokens/TokenService.js";
import type { RefreshTokenRepository } from "../domain/tokens/RefreshTokenRepository.js";
import type { LoginAttemptTracker } from "../domain/security/LoginAttemptTracker.js";
import type { GeoIPValidator } from "../domain/security/GeoIPValidator.js";
import type IdentityManagerService from "../../../core/IdentityManagerService/index.js";
import {
	RegisterEndpoint,
	UncommonResponse,
	type EndpointCtx,
	type SetCookie,
	type ClearCookie,
} from "../../../core/EndpointManagerService/index.js";
import { AuthError } from "@common/types/custom-errors/AuthError.ts";
import type { AuthenticatedUser } from "../types.js";

/** Nombre de las cookies */
const ACCESS_COOKIE_NAME = "access_token";
const REFRESH_COOKIE_NAME = "refresh_token";

export interface AuthEndpointsDeps {
	keyStore: KeyStore;
	tokenService: TokenService;
	refreshTokenRepo: RefreshTokenRepository;
	loginTracker: LoginAttemptTracker;
	geoValidator: GeoIPValidator;
	identityService: IdentityManagerService | null;
	cookieDomain: string;
	defaultRedirectUrl: string;
	logger: { logError: (msg: string) => void; logWarn: (msg: string) => void };
}

interface LoginBody {
	username?: string;
	password?: string;
}

interface RegisterBody {
	username?: string;
	email?: string;
	password?: string;
}

/**
 * Endpoints de autenticación nativa (usuario/contraseña)
 * Singleton con métodos estáticos y @RegisterEndpoint
 */
export class AuthEndpoints {
	private static deps: AuthEndpointsDeps;
	private static validateCredentials: (username: string, password: string) => Promise<{ id: string; username: string; email?: string } | null>;

	static init(
		deps: AuthEndpointsDeps,
		validateCredentials: (username: string, password: string) => Promise<{ id: string; username: string; email?: string } | null>
	): void {
		AuthEndpoints.deps ??= deps;
		AuthEndpoints.validateCredentials ??= validateCredentials;
	}

	/**
	 * POST /api/auth/login - Login con usuario/contraseña
	 */
	@RegisterEndpoint({
		method: "POST",
		url: "/api/auth/login",
		permissions: [],
	})
	static async handleNativeLogin(ctx: EndpointCtx<Record<string, string>, LoginBody>): Promise<unknown> {
		const { username, password } = ctx.data || {};

		if (!username || !password) {
			throw new AuthError(400, "MISSING_CREDENTIALS", "Username y password son requeridos");
		}

		try {
			const profile = await AuthEndpoints.validateCredentials(username, password);

			if (!profile) {
				const tempUserId = `login_attempt_${username}`;
				const blockStatus = await AuthEndpoints.deps.loginTracker.recordLoginAttempt(tempUserId, false, ctx.ip);

				if (blockStatus.blocked) {
					throw new AuthError(403, "ACCOUNT_BLOCKED", "Cuenta bloqueada temporalmente", {
						blockedUntil: blockStatus.blockedUntil ?? undefined,
						permanent: blockStatus.permanent,
					});
				}

				throw new AuthError(401, "INVALID_CREDENTIALS", "Credenciales inválidas");
			}

			const user = await AuthEndpoints.getOrCreateUser("platform", {
				id: profile.id,
				username: profile.username,
				email: profile.email,
			});

			const blockStatus = await AuthEndpoints.deps.loginTracker.isBlocked(user.id);
			if (blockStatus.blocked) {
				throw new AuthError(403, "ACCOUNT_BLOCKED", blockStatus.permanent ? "Cuenta bloqueada" : "Cuenta bloqueada temporalmente", {
					blockedUntil: blockStatus.blockedUntil ?? undefined,
					permanent: blockStatus.permanent,
				});
			}

			await AuthEndpoints.deps.loginTracker.recordLoginAttempt(user.id, true, ctx.ip);
			const cookies = await AuthEndpoints.getTokenCookies(ctx, user);

			throw UncommonResponse.json(
				{
					success: true,
					user: {
						id: user.id,
						username: user.username,
						email: user.email,
						permissions: user.permissions,
					},
				},
				{ cookies }
			);
		} catch (err: any) {
			if (err instanceof AuthError || err instanceof UncommonResponse) throw err;
			AuthEndpoints.deps.logger.logError(`Error en login nativo: ${err.message}`);
			throw new AuthError(500, "AUTH_ERROR", "Error durante la autenticación");
		}
	}

	/**
	 * POST /api/auth/register - Registro de nuevo usuario
	 */
	@RegisterEndpoint({
		method: "POST",
		url: "/api/auth/register",
		permissions: [],
	})
	static async handleRegister(ctx: EndpointCtx<Record<string, string>, RegisterBody>): Promise<unknown> {
		const { username, email, password } = ctx.data || {};

		if (!username || !email || !password) {
			throw new AuthError(400, "MISSING_FIELDS", "Username, email y password son requeridos");
		}

		// Validaciones básicas
		if (username.length < 3 || username.length > 30) {
			throw new AuthError(400, "INVALID_USERNAME", "El nombre de usuario debe tener entre 3 y 30 caracteres");
		}

		if (password.length < 8) {
			throw new AuthError(400, "WEAK_PASSWORD", "La contraseña debe tener al menos 8 caracteres");
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw new AuthError(400, "INVALID_EMAIL", "El email no es válido");
		}

		if (!AuthEndpoints.deps.identityService) {
			throw new AuthError(500, "SERVICE_UNAVAILABLE", "Servicio de identidad no disponible");
		}

		try {
			// Verificar si el usuario o email ya existe
			const users = AuthEndpoints.deps.identityService.users;
			const allUsers = await users.getAllUsers();
			const existingUsername = allUsers.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
			const existingEmail = allUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

			if (existingUsername) {
				throw new AuthError(409, "USERNAME_EXISTS", "El nombre de usuario ya está en uso");
			}

			if (existingEmail) {
				throw new AuthError(409, "EMAIL_EXISTS", "El email ya está registrado");
			}

			// Crear usuario
			const newUser = await users.createUser(username, password, []);

			// Actualizar con email
			await users.updateUser(newUser.id, {
				email,
				metadata: {
					createdVia: "platform",
					createdAt: new Date().toISOString(),
				},
			});

			// Obtener usuario completo para login automático
			const user = await AuthEndpoints.getOrCreateUser("platform", {
				id: newUser.id,
				username,
				email,
			});

			// Emitir tokens (login automático tras registro)
			const cookies = await AuthEndpoints.getTokenCookies(ctx, user);

			throw UncommonResponse.json(
				{
					success: true,
					user: {
						id: user.id,
						username: user.username,
						email: user.email,
						permissions: user.permissions,
					},
				},
				{ cookies }
			);
		} catch (err: any) {
			if (err instanceof AuthError || err instanceof UncommonResponse) throw err;
			AuthEndpoints.deps.logger.logError(`Error en registro: ${err.message}`);
			throw new AuthError(500, "REGISTER_ERROR", "Error al crear la cuenta");
		}
	}

	/**
	 * GET /api/auth/session - Verificar sesión actual
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/auth/session",
		permissions: [],
	})
	static async handleSession(ctx: EndpointCtx): Promise<unknown> {
		const token = ctx.cookies?.[ACCESS_COOKIE_NAME];

		if (!token) {
			throw new AuthError(401, "NO_SESSION", "No hay sesión activa");
		}

		const result = await AuthEndpoints.deps.tokenService.verifyAccessToken(token);

		if (!result.valid || !result.session) {
			throw new AuthError(401, "INVALID_SESSION", result.error || "Sesión inválida");
		}

		const headers: Record<string, string> = {};
		if (result.usedPreviousKey) {
			headers["X-Refresh-Required"] = "true";
		}

		// Si hay headers especiales, usar UncommonResponse
		if (Object.keys(headers).length > 0) {
			throw UncommonResponse.json(
				{
					authenticated: true,
					user: {
						id: result.session.user.id,
						username: result.session.user.username,
						email: result.session.user.email,
						avatar: result.session.user.avatar,
						provider: result.session.user.provider,
						orgId: result.session.user.orgId,
					},
					expiresAt: result.session.expiresAt,
				},
				{ headers }
			);
		}

		return {
			authenticated: true,
			user: {
				id: result.session.user.id,
				username: result.session.user.username,
				email: result.session.user.email,
				avatar: result.session.user.avatar,
				provider: result.session.user.provider,
				orgId: result.session.user.orgId,
			},
			expiresAt: result.session.expiresAt,
		};
	}

	/**
	 * POST /api/auth/refresh - Refrescar tokens
	 */
	@RegisterEndpoint({
		method: "POST",
		url: "/api/auth/refresh",
		permissions: [],
	})
	static async handleRefresh(ctx: EndpointCtx): Promise<never> {
		const refreshToken = ctx.cookies?.[REFRESH_COOKIE_NAME];

		if (!refreshToken) {
			throw new AuthError(401, "NO_REFRESH_TOKEN", "No hay refresh token");
		}

		const storedToken = await AuthEndpoints.deps.refreshTokenRepo.findByToken(refreshToken);

		if (!storedToken) {
			throw new AuthError(401, "INVALID_REFRESH_TOKEN", "Refresh token inválido");
		}

		// Validar cambio de país usando Cloudflare headers
		const currentCountry = AuthEndpoints.deps.geoValidator.getCountryFromHeaders(ctx.headers);
		const geoValidation = AuthEndpoints.deps.geoValidator.validateLocationChange(currentCountry, storedToken.country);

		if (!geoValidation.valid) {
			await AuthEndpoints.deps.tokenService.revokeAllUserTokens(storedToken.userId);
			AuthEndpoints.deps.logger.logWarn(`Cambio de país detectado para usuario ${storedToken.userId}: ${geoValidation.reason}`);

			throw new AuthError(401, "LOCATION_CHANGE", "Sesión invalidada por cambio de ubicación", {
				requireRelogin: true,
			});
		}

		const refreshAttempt = await AuthEndpoints.deps.loginTracker.recordRefreshAttempt(storedToken.userId, true);

		if (refreshAttempt.blocked) {
			if (refreshAttempt.shouldDeleteTokens) {
				await AuthEndpoints.deps.tokenService.deleteAllUserTokens(storedToken.userId);
			}

			throw new AuthError(403, "ACCOUNT_BLOCKED", "Cuenta bloqueada por actividad sospechosa", {
				permanent: refreshAttempt.status.permanent,
			});
		}

		const ipAddress = AuthEndpoints.deps.geoValidator.extractRealIP(ctx.headers, ctx.ip);
		const result = await AuthEndpoints.deps.tokenService.refreshTokens(
			refreshToken,
			ipAddress,
			currentCountry,
			ctx.headers["user-agent"]?.toString() || "unknown",
			async (userId: string) => AuthEndpoints.getUserById(userId)
		);

		if (!result.success || !result.tokens) {
			const failResult = await AuthEndpoints.deps.loginTracker.recordRefreshAttempt(storedToken.userId, false);

			if (failResult.blocked && failResult.shouldDeleteTokens) {
				await AuthEndpoints.deps.tokenService.deleteAllUserTokens(storedToken.userId);
			}

			throw new AuthError(401, "REFRESH_FAILED", result.error || "Error al refrescar tokens");
		}

		const cookies = AuthEndpoints.buildTokenCookies(result.tokens.accessToken, result.tokens.refreshToken.token);
		throw UncommonResponse.json({ success: true }, { cookies });
	}

	/**
	 * POST /api/auth/logout - Cerrar sesión
	 */
	@RegisterEndpoint({
		method: "POST",
		url: "/api/auth/logout",
		permissions: [],
	})
	static async handleLogout(ctx: EndpointCtx): Promise<never> {
		const refreshToken = ctx.cookies?.[REFRESH_COOKIE_NAME];

		if (refreshToken) {
			await AuthEndpoints.deps.refreshTokenRepo.revoke(refreshToken);
		}

		const clearCookies: ClearCookie[] = [
			{ name: ACCESS_COOKIE_NAME, options: { path: "/" } },
			{ name: REFRESH_COOKIE_NAME, options: { path: "/api/auth/refresh", domain: AuthEndpoints.deps.cookieDomain } },
		];

		throw UncommonResponse.json({ success: true, message: "Sesión cerrada" }, { clearCookies });
	}

	// ============ Métodos auxiliares (privados estáticos) ============

	private static async getTokenCookies(ctx: EndpointCtx, user: AuthenticatedUser): Promise<SetCookie[]> {
		const ipAddress = AuthEndpoints.deps.geoValidator.extractRealIP(ctx.headers, ctx.ip);
		const country = AuthEndpoints.deps.geoValidator.getCountryFromHeaders(ctx.headers);
		const deviceId = AuthEndpoints.generateDeviceId(ctx.headers);
		const userAgent = ctx.headers["user-agent"]?.toString() || "unknown";

		const tokens = await AuthEndpoints.deps.tokenService.createTokenPair(user, deviceId, ipAddress, country, userAgent);
		return AuthEndpoints.buildTokenCookies(tokens.accessToken, tokens.refreshToken.token);
	}

	private static buildTokenCookies(accessToken: string, refreshToken: string): SetCookie[] {
		const accessConfig = AuthEndpoints.deps.tokenService.getAccessCookieConfig();
		const refreshConfig = AuthEndpoints.deps.tokenService.getRefreshCookieConfig();

		return [
			{
				name: accessConfig.name,
				value: accessToken,
				options: {
					httpOnly: accessConfig.httpOnly,
					secure: accessConfig.secure,
					sameSite: accessConfig.sameSite,
					path: accessConfig.path,
					maxAge: accessConfig.maxAge,
				},
			},
			{
				name: refreshConfig.name,
				value: refreshToken,
				options: {
					httpOnly: refreshConfig.httpOnly,
					secure: refreshConfig.secure,
					sameSite: refreshConfig.sameSite,
					path: refreshConfig.path,
					maxAge: refreshConfig.maxAge,
					domain: refreshConfig.domain,
				},
			},
		];
	}

	private static generateDeviceId(headers: Record<string, string | undefined>): string {
		const ua = headers["user-agent"]?.toString() || "";
		const accept = headers["accept"]?.toString() || "";
		const lang = headers["accept-language"]?.toString() || "";

		const fingerprint = `${ua}|${accept}|${lang}`;
		let hash = 0;
		for (let i = 0; i < fingerprint.length; i++) {
			const char = fingerprint.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		return `device_${Math.abs(hash).toString(36)}`;
	}

	private static async getOrCreateUser(
		provider: string,
		profile: { id: string; username: string; email?: string; avatar?: string }
	): Promise<AuthenticatedUser> {
		if (!AuthEndpoints.deps.identityService) {
			return {
				id: `temp_${profile.id}`,
				providerId: profile.id,
				provider,
				username: profile.username,
				email: profile.email,
				avatar: profile.avatar,
				permissions: ["public.read"],
			};
		}

		const providerIdField = `${provider}Id`;
		const users = AuthEndpoints.deps.identityService.users;
		const allUsers = await users.getAllUsers();
		let existingUser = allUsers.find(
			(u: any) => u.metadata?.[providerIdField] === profile.id || (profile.email && u.email === profile.email)
		);

		if (existingUser) {
			if (!existingUser.metadata?.[providerIdField]) {
				const updatedMetadata = { ...existingUser.metadata, [providerIdField]: profile.id };
				await users.updateUser(existingUser.id, { metadata: updatedMetadata });
				existingUser = { ...existingUser, metadata: updatedMetadata };
			}

			const permissions = await AuthEndpoints.getUserPermissions(existingUser.id);
			return {
				id: existingUser.id,
				providerId: profile.id,
				provider,
				username: existingUser.username,
				email: existingUser.email,
				avatar: profile.avatar || existingUser.metadata?.avatar,
				permissions,
				metadata: existingUser.metadata,
			};
		}

		const { randomBytes } = await import("node:crypto");
		const randomPassword = randomBytes(16).toString("base64");
		const newUser = await users.createUser(profile.username, randomPassword, []);

		await users.updateUser(newUser.id, {
			email: profile.email,
			metadata: {
				[providerIdField]: profile.id,
				avatar: profile.avatar,
				createdVia: provider,
			},
		});

		const defaultPermissions = await AuthEndpoints.getDefaultPermissions();
		return {
			id: newUser.id,
			providerId: profile.id,
			provider,
			username: newUser.username,
			email: profile.email,
			avatar: profile.avatar,
			permissions: defaultPermissions,
		};
	}

	private static async getUserById(userId: string): Promise<AuthenticatedUser | null> {
		if (!AuthEndpoints.deps.identityService) return null;

		try {
			const users = AuthEndpoints.deps.identityService.users;
			const user = await users.getUser(userId);
			if (!user) return null;

			const permissions = await AuthEndpoints.getUserPermissions(userId);
			return {
				id: user.id,
				provider: (user.metadata?.createdVia as string) || "platform",
				username: user.username,
				email: user.email,
				avatar: user.metadata?.avatar as string,
				permissions,
				metadata: user.metadata,
			};
		} catch {
			return null;
		}
	}

	private static async getUserPermissions(userId: string): Promise<string[]> {
		if (!AuthEndpoints.deps.identityService) return ["public.read"];

		try {
			const permissions = AuthEndpoints.deps.identityService.permissions;
			const resolved = await permissions.resolvePermissions(userId);
			return resolved.map((p: { resource: string; scope: number; action: number }) => `${p.resource}.${p.scope}.${p.action}`);
		} catch {
			return ["public.read"];
		}
	}

	private static async getDefaultPermissions(): Promise<string[]> {
		return ["public.read", "profile.self.read", "profile.self.write"];
	}
}
