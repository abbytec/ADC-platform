import { randomBytes } from "node:crypto";
import { BaseService } from "../../BaseService.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import type IdentityManagerService from "../../core/IdentityManagerService/index.js";
import type { IJWTProviderMultiKey } from "../../../providers/security/jwt/index.js";
import type { IRedisProvider } from "../../../providers/queue/redis/index.js";
import type { AuthenticatedUser, OAuthProviderConfig, AuthRequest, AuthReply, TokenVerificationResult } from "./types.js";

// Domain components
import { KeyStore } from "./domain/keys/KeyStore.js";
import { TokenService } from "./domain/tokens/TokenService.js";
import { RefreshTokenRepository } from "./domain/tokens/RefreshTokenRepository.js";
import { LoginAttemptTracker } from "./domain/security/LoginAttemptTracker.js";
import { GeoIPValidator } from "./domain/security/GeoIPValidator.js";
import { SessionManager } from "./domain/session/manager.js";
import { OAuthProviderRegistry, PlatformAuthProvider } from "./domain/oauth/index.js";

// Re-exportar tipos
export type { AuthenticatedUser, TokenVerificationResult };

/** Configuración custom del servicio (desde config.json + .env) */
interface SessionManagerConfig {
	baseUrl?: string;
	discordClientId?: string;
	discordClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
}

/** Nombre de las cookies */
const ACCESS_COOKIE_NAME = "access_token";
const REFRESH_COOKIE_NAME = "refresh_token";
const STATE_COOKIE_NAME = "oauth_state";

const isProd = process.env.NODE_ENV === "production";

/**
 * SessionManagerService - Orquestador de autenticación y sesiones
 *
 * Características de seguridad:
 * - Rotación automática de secretos cada 24h
 * - Access Token (JWT) con expiración de 15 minutos
 * - Refresh Token (opaco) con expiración de 30 días
 * - Detección de cambio de país por IP (Cloudflare cf-ipcountry)
 * - Rate limiting en login y refresh
 * - Bloqueo automático por intentos sospechosos
 * - Redis para estado distribuido (opcional)
 */
export default class SessionManagerService extends BaseService {
	public readonly name = "SessionManagerService";

	// Providers externos
	#httpProvider: IHttpServerProvider | null = null;
	#identityService: IdentityManagerService | null = null;
	#jwtProvider: IJWTProviderMultiKey | null = null;
	#redis: IRedisProvider | null = null;

	// Componentes de dominio
	#keyStore: KeyStore | null = null;
	#tokenService: TokenService | null = null;
	#refreshTokenRepo: RefreshTokenRepository | null = null;
	#loginTracker: LoginAttemptTracker | null = null;
	#geoValidator: GeoIPValidator | null = null;
	#sessionManager: SessionManager | null = null;
	#oauthRegistry: OAuthProviderRegistry | null = null;

	// Configuración
	#defaultRedirectUrl = "https://adigitalcafe.com";
	#cookieDomain = ".adigitalcafe.com";

	#kernelKey?: symbol;

	/** Configuración custom interpolada desde config.json + .env */
	get #customConfig(): SessionManagerConfig {
		return (this.config?.custom || {}) as SessionManagerConfig;
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);
		this.#kernelKey = kernelKey;

		// Obtener providers
		this.#httpProvider = this.kernel.getProvider<IHttpServerProvider>("fastify-server");
		this.#jwtProvider = this.kernel.getProvider<IJWTProviderMultiKey>("security/jwt");
		this.#identityService = this.kernel.getService<IdentityManagerService>("IdentityManagerService");

		// Redis es opcional - funciona con fallback en memoria
		try {
			this.#redis = this.kernel.getProvider<IRedisProvider>("redis");
		} catch {
			this.logger.logWarn("Redis no disponible, usando almacenamiento en memoria");
		}

		if (!this.#httpProvider) {
			throw new Error("SessionManagerService requiere http-server-provider");
		}

		if (!this.#jwtProvider) {
			throw new Error("SessionManagerService requiere jwt provider");
		}

		// Inicializar componentes de dominio con Redis si está disponible
		await this.#initDomainComponents();

		// Registrar endpoints
		this.#registerEndpoints();

		this.logger.logOk(`SessionManagerService iniciado${this.#redis ? " con Redis" : ""}`);
	}

	async #initDomainComponents(): Promise<void> {
		// KeyStore con rotación de 24h
		this.#keyStore = new KeyStore({
			rotationInterval: 24 * 60 * 60 * 1000,
			keyLength: 32,
			initialKeys: {
				current: randomBytes(32).toString("base64"),
				previous: undefined,
			},
			redis: this.#redis || undefined,
		});

		await this.#keyStore.init();
		this.#keyStore.onRotation((keys) => {
			this.logger.logInfo(`Claves rotadas. Nueva clave activa desde ${new Date(keys.rotatedAt).toISOString()}`);
		});
		this.#keyStore.startRotation();

		// RefreshTokenRepository (30 días)
		this.#refreshTokenRepo = new RefreshTokenRepository(30 * 24 * 60 * 60, this.#redis || undefined);

		// TokenService
		this.#tokenService = new TokenService(this.#keyStore, this.#jwtProvider!, this.#refreshTokenRepo, {
			accessTokenTtl: "15m",
			refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
			cookieDomain: this.#cookieDomain,
		});

		// LoginAttemptTracker
		this.#loginTracker = new LoginAttemptTracker(this.#redis || undefined);
		this.#loginTracker.setCallbacks(
			async (userId, blocked) => {
				this.logger.logWarn(`Usuario ${userId} bloqueado: ${blocked}`);
			},
			async (userId, reason) => {
				this.logger.logWarn(`Alerta de seguridad para ${userId}: ${reason}`);
			}
		);

		// GeoIPValidator (simplificado - usa Cloudflare headers)
		this.#geoValidator = new GeoIPValidator();

		// SessionManager (para state OAuth)
		this.#sessionManager = new SessionManager({
			jwtProvider: this.#jwtProvider!,
			cookieConfig: {
				name: ACCESS_COOKIE_NAME,
				httpOnly: true,
				secure: isProd,
				sameSite: "lax",
				path: "/",
				maxAge: 15 * 60,
			},
			stateExpiration: 10 * 60 * 1000,
		});

		// OAuth providers
		this.#oauthRegistry = new OAuthProviderRegistry();
		this.#oauthRegistry.register(
			new PlatformAuthProvider(async (username, password) => {
				return this.#validatePlatformCredentials(username, password);
			})
		);
	}

	#registerEndpoints(): void {
		if (!this.#httpProvider) return;

		this.#httpProvider.registerRoute("GET", "/api/auth/login/:provider", (req: any, res: any) => this.#handleLogin(req, res));
		this.#httpProvider.registerRoute("GET", "/api/auth/callback/:provider", (req: any, res: any) => this.#handleCallback(req, res));
		this.#httpProvider.registerRoute("POST", "/api/auth/login", (req: any, res: any) => this.#handleNativeLogin(req, res));
		this.#httpProvider.registerRoute("GET", "/api/auth/session", (req: any, res: any) => this.#handleSession(req, res));
		this.#httpProvider.registerRoute("POST", "/api/auth/refresh", (req: any, res: any) => this.#handleRefresh(req, res));
		this.#httpProvider.registerRoute("POST", "/api/auth/logout", (req: any, res: any) => this.#handleLogout(req, res));
	}

	async #handleLogin(req: AuthRequest, res: AuthReply): Promise<void> {
		const provider = req.params?.provider || "platform";

		if (!this.#oauthRegistry?.has(provider)) {
			res.status(400).send({ error: `Proveedor '${provider}' no soportado` });
			return;
		}

		const oauthProvider = this.#oauthRegistry.get(provider)!;
		const config = this.#getProviderConfig(provider);

		if (!config) {
			res.status(500).send({ error: `Configuración del proveedor '${provider}' no encontrada` });
			return;
		}

		const state = this.#sessionManager!.generateState();

		res.setCookie(STATE_COOKIE_NAME, state, {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 600,
		});

		const authUrl = oauthProvider.getAuthorizationUrl(state, config);
		res.redirect(authUrl);
	}

	async #handleCallback(req: AuthRequest, res: AuthReply): Promise<void> {
		const provider = req.params?.provider || "platform";
		const { code, state, error, error_description } = req.query || {};

		if (error) {
			this.logger.logError(`OAuth error de ${provider}: ${error} - ${error_description}`);
			res.redirect(`/auth/error?error=${encodeURIComponent(error_description || error)}`);
			return;
		}

		if (!code || !state) {
			res.status(400).send({ error: "Parámetros code o state faltantes" });
			return;
		}

		const cookieState = req.cookies?.[STATE_COOKIE_NAME];
		if (!this.#sessionManager!.validateState(state, cookieState || "")) {
			res.status(403).send({ error: "State inválido - posible ataque CSRF" });
			return;
		}

		res.clearCookie(STATE_COOKIE_NAME, { path: "/" });

		try {
			const oauthProvider = this.#oauthRegistry!.get(provider);
			if (!oauthProvider) {
				res.status(400).send({ error: `Proveedor '${provider}' no soportado` });
				return;
			}

			const config = this.#getProviderConfig(provider);
			if (!config) {
				res.status(500).send({ error: "Configuración del proveedor no encontrada" });
				return;
			}

			const tokens = await oauthProvider.exchangeCode(code, config);
			const profile = await oauthProvider.getUserProfile(tokens.accessToken);
			const user = await this.#getOrCreateUser(provider, profile);

			await this.#issueTokens(req, res, user);

			const redirectUrl = this.#getRedirectUrl(user);
			res.redirect(redirectUrl);
		} catch (err: any) {
			this.logger.logError(`Error en callback de ${provider}: ${err.message}`);
			res.redirect(`/auth/error?error=${encodeURIComponent("Error durante la autenticación")}`);
		}
	}

	async #handleNativeLogin(req: any, res: AuthReply): Promise<void> {
		const { username, password } = req.body || {};

		if (!username || !password) {
			res.status(400).send({ error: "Username y password son requeridos" });
			return;
		}

		try {
			const profile = await this.#validatePlatformCredentials(username, password);

			if (!profile) {
				const tempUserId = `login_attempt_${username}`;
				const blockStatus = await this.#loginTracker!.recordLoginAttempt(tempUserId, false, req.ip);

				if (blockStatus.blocked) {
					res.status(403).send({
						error: "Cuenta bloqueada temporalmente",
						blockedUntil: blockStatus.blockedUntil,
						permanent: blockStatus.permanent,
					});
					return;
				}

				res.status(401).send({ error: "Credenciales inválidas" });
				return;
			}

			const user = await this.#getOrCreateUser("platform", {
				id: profile.id,
				username: profile.username,
				email: profile.email,
			});

			const blockStatus = await this.#loginTracker!.isBlocked(user.id);
			if (blockStatus.blocked) {
				res.status(403).send({
					error: blockStatus.permanent ? "Cuenta bloqueada" : "Cuenta bloqueada temporalmente",
					blockedUntil: blockStatus.blockedUntil,
					permanent: blockStatus.permanent,
				});
				return;
			}

			await this.#loginTracker!.recordLoginAttempt(user.id, true, req.ip);
			await this.#issueTokens(req, res, user);

			res.send({
				success: true,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					permissions: user.permissions,
				},
			});
		} catch (err: any) {
			this.logger.logError(`Error en login nativo: ${err.message}`);
			res.status(500).send({ error: "Error durante la autenticación" });
		}
	}

	async #handleSession(req: AuthRequest, res: AuthReply): Promise<void> {
		const token = req.cookies?.[ACCESS_COOKIE_NAME];

		if (!token) {
			res.status(401).send({ authenticated: false, error: "No hay sesión activa" });
			return;
		}

		const result = await this.#tokenService!.verifyAccessToken(token);

		if (!result.valid || !result.session) {
			res.status(401).send({ authenticated: false, error: result.error });
			return;
		}

		if (result.usedPreviousKey) {
			res.header("X-Refresh-Required", "true");
		}

		res.send({
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
		});
	}

	async #handleRefresh(req: AuthRequest, res: AuthReply): Promise<void> {
		const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

		if (!refreshToken) {
			res.status(401).send({ error: "No hay refresh token" });
			return;
		}

		const storedToken = await this.#refreshTokenRepo!.findByToken(refreshToken);

		if (!storedToken) {
			res.status(401).send({ error: "Refresh token inválido" });
			return;
		}

		// Validar cambio de país usando Cloudflare headers
		const currentCountry = this.#geoValidator!.getCountryFromHeaders(req.headers);
		const geoValidation = this.#geoValidator!.validateLocationChange(currentCountry, storedToken.country);

		if (!geoValidation.valid) {
			await this.#tokenService!.revokeAllUserTokens(storedToken.userId);
			this.logger.logWarn(`Cambio de país detectado para usuario ${storedToken.userId}: ${geoValidation.reason}`);

			res.status(401).send({
				error: "Sesión invalidada por cambio de ubicación",
				requireRelogin: true,
			});
			return;
		}

		const refreshAttempt = await this.#loginTracker!.recordRefreshAttempt(storedToken.userId, true);

		if (refreshAttempt.blocked) {
			if (refreshAttempt.shouldDeleteTokens) {
				await this.#tokenService!.deleteAllUserTokens(storedToken.userId);
			}

			res.status(403).send({
				error: "Cuenta bloqueada por actividad sospechosa",
				permanent: refreshAttempt.status.permanent,
			});
			return;
		}

		const ipAddress = this.#geoValidator!.extractRealIP(req.headers, req.ip);
		const result = await this.#tokenService!.refreshTokens(
			refreshToken,
			ipAddress,
			currentCountry,
			req.headers["user-agent"]?.toString() || "unknown",
			async (userId) => this.#getUserById(userId)
		);

		if (!result.success || !result.tokens) {
			const failResult = await this.#loginTracker!.recordRefreshAttempt(storedToken.userId, false);

			if (failResult.blocked && failResult.shouldDeleteTokens) {
				await this.#tokenService!.deleteAllUserTokens(storedToken.userId);
			}

			res.status(401).send({ error: result.error || "Error al refrescar tokens" });
			return;
		}

		this.#setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken.token);
		res.send({ success: true });
	}

	async #handleLogout(req: AuthRequest, res: AuthReply): Promise<void> {
		const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

		if (refreshToken) {
			await this.#refreshTokenRepo!.revoke(refreshToken);
		}

		res.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
		res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth/refresh", domain: this.#cookieDomain });

		res.send({ success: true, message: "Sesión cerrada" });
	}

	async #issueTokens(req: AuthRequest, res: AuthReply, user: AuthenticatedUser): Promise<void> {
		const ipAddress = this.#geoValidator!.extractRealIP(req.headers, req.ip);
		const country = this.#geoValidator!.getCountryFromHeaders(req.headers);
		const deviceId = this.#generateDeviceId(req);
		const userAgent = req.headers["user-agent"]?.toString() || "unknown";

		const tokens = await this.#tokenService!.createTokenPair(user, deviceId, ipAddress, country, userAgent);
		this.#setTokenCookies(res, tokens.accessToken, tokens.refreshToken.token);
	}

	#setTokenCookies(res: AuthReply, accessToken: string, refreshToken: string): void {
		const accessConfig = this.#tokenService!.getAccessCookieConfig();
		const refreshConfig = this.#tokenService!.getRefreshCookieConfig();

		res.setCookie(accessConfig.name, accessToken, {
			httpOnly: accessConfig.httpOnly,
			secure: accessConfig.secure,
			sameSite: accessConfig.sameSite,
			path: accessConfig.path,
			maxAge: accessConfig.maxAge,
		});

		res.setCookie(refreshConfig.name, refreshToken, {
			httpOnly: refreshConfig.httpOnly,
			secure: refreshConfig.secure,
			sameSite: refreshConfig.sameSite,
			path: refreshConfig.path,
			maxAge: refreshConfig.maxAge,
			domain: refreshConfig.domain,
		});
	}

	#generateDeviceId(req: AuthRequest): string {
		const ua = req.headers["user-agent"]?.toString() || "";
		const accept = req.headers["accept"]?.toString() || "";
		const lang = req.headers["accept-language"]?.toString() || "";

		const fingerprint = `${ua}|${accept}|${lang}`;
		let hash = 0;
		for (let i = 0; i < fingerprint.length; i++) {
			const char = fingerprint.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		return `device_${Math.abs(hash).toString(36)}`;
	}

	async verifyToken(token: string): Promise<TokenVerificationResult> {
		if (!this.#tokenService) {
			return { valid: false, error: "SessionManagerService no inicializado" };
		}

		const result = await this.#tokenService.verifyAccessToken(token);
		return {
			valid: result.valid,
			session: result.session,
			error: result.error,
			usedPreviousKey: result.usedPreviousKey,
		};
	}


	/**
	 * Login programático - Solo para servicios del kernel
	 *
	 * Permite autenticar un usuario sin pasar por HTTP.
	 * Requiere kernelKey para prevenir uso no autorizado.
	 *
	 * @returns Token de acceso válido o null si las credenciales son inválidas
	 */
	async loginProgrammatic(kernelKey: symbol, username: string, password: string): Promise<string | null> {
		// Verificar que es una llamada autorizada del kernel
		if (this.#kernelKey !== kernelKey) {
			throw new Error("Acceso denegado: kernelKey inválido");
		}

		if (!this.#tokenService || !this.#keyStore || !this.#jwtProvider) {
			throw new Error("SessionManagerService no está inicializado");
		}

		// Validar credenciales
		const profile = await this.#validatePlatformCredentials(username, password);
		if (!profile) {
			return null;
		}

		// Obtener usuario existente con permisos (si las credenciales son válidas, el usuario ya existe)
		const user = await this.#getUserById(profile.id);
		if (!user) {
			return null;
		}

		// Crear token
		const currentKey = this.#keyStore.getCurrentKey();
		const payload = {
			userId: user.id,
			permissions: user.permissions,
			deviceId: `kernel_${Date.now()}`,
			metadata: {
				provider: user.provider,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				orgId: user.orgId,
			},
		};

		return this.#jwtProvider.encryptWithKey(payload, currentKey, "15m");
	}

	extractSessionToken(req: { cookies?: Record<string, string> }): string | null {
		return req.cookies?.[ACCESS_COOKIE_NAME] || null;
	}

	#getProviderConfig(provider: string): OAuthProviderConfig | null {
		const cfg = this.#customConfig;
		const baseUrl = cfg.baseUrl || "http://localhost:3000";

		const configs: Record<string, OAuthProviderConfig> = {
			discord: {
				clientId: cfg.discordClientId || "",
				clientSecret: cfg.discordClientSecret || "",
				redirectUri: `${baseUrl}/api/auth/callback/discord`,
				scopes: ["identify", "email"],
			},
			google: {
				clientId: cfg.googleClientId || "",
				clientSecret: cfg.googleClientSecret || "",
				redirectUri: `${baseUrl}/api/auth/callback/google`,
				scopes: ["openid", "email", "profile"],
			},
			platform: {
				clientId: "platform",
				clientSecret: "",
				redirectUri: `${baseUrl}/api/auth/callback/platform`,
				scopes: [],
			},
		};

		return configs[provider] || null;
	}

	async #getOrCreateUser(
		provider: string,
		profile: { id: string; username: string; email?: string; avatar?: string }
	): Promise<AuthenticatedUser> {
		if (!this.#identityService) {
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
		const users = this.#identityService.users;
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

			const permissions = await this.#getUserPermissions(existingUser.id);
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

		const defaultPermissions = await this.#getDefaultPermissions();
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

	async #getUserById(userId: string): Promise<AuthenticatedUser | null> {
		if (!this.#identityService) return null;

		try {
			const users = this.#identityService.users;
			const user = await users.getUser(userId);
			if (!user) return null;

			const permissions = await this.#getUserPermissions(userId);
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

	async #getUserPermissions(userId: string): Promise<string[]> {
		if (!this.#identityService) return ["public.read"];

		try {
			const permissions = this.#identityService.permissions;
			const resolved = await permissions.resolvePermissions(userId);
			return resolved.map((p: { resource: string; scope: number; action: number }) => `${p.resource}.${p.scope}.${p.action}`);
		} catch {
			return ["public.read"];
		}
	}

	async #getDefaultPermissions(): Promise<string[]> {
		return ["public.read", "profile.self.read", "profile.self.write"];
	}

	#getRedirectUrl(user: AuthenticatedUser): string {
		if (user.orgId) {
			return `https://${user.orgId}.adigitalcafe.com`;
		}
		return this.#defaultRedirectUrl;
	}

	async #validatePlatformCredentials(username: string, password: string): Promise<{ id: string; username: string; email?: string } | null> {
		if (!this.#identityService) return null;

		try {
			const users = this.#identityService.users;
			const user = await users.authenticate(username, password);
			if (user) {
				return { id: user.id, username: user.username, email: user.email };
			}
			return null;
		} catch {
			return null;
		}
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);

		this.#keyStore?.stopRotation();
		this.#refreshTokenRepo?.stop();
		this.#loginTracker?.stop();

		this.#keyStore = null;
		this.#tokenService = null;
		this.#refreshTokenRepo = null;
		this.#loginTracker = null;
		this.#geoValidator = null;
		this.#sessionManager = null;
		this.#oauthRegistry = null;

		this.logger.logDebug("SessionManagerService detenido");
	}
}
