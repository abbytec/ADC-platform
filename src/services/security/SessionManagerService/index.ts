import { randomBytes } from "node:crypto";
import { BaseService } from "../../BaseService.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import type IdentityManagerService from "../../core/IdentityManagerService/index.js";
import type { IJWTProviderMultiKey } from "../../../providers/security/jwt/index.js";
import type { IRedisProvider } from "../../../providers/queue/redis/index.js";
import type { AuthenticatedUser, OAuthProviderConfig, TokenVerificationResult } from "./types.js";

// Domain components
import { KeyStore } from "./domain/keys/KeyStore.js";
import { TokenService } from "./domain/tokens/TokenService.js";
import { RefreshTokenRepository } from "./domain/tokens/RefreshTokenRepository.js";
import { LoginAttemptTracker } from "./domain/security/LoginAttemptTracker.js";
import { GeoIPValidator } from "./domain/security/GeoIPValidator.js";
import { SessionManager } from "./domain/session/manager.js";
import { OAuthProviderRegistry, PlatformAuthProvider } from "./domain/oauth/index.js";

// Endpoints
import { AuthEndpoints } from "./endpoints/auth.js";
import { OAuthEndpoints } from "./endpoints/oauth.js";

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

	// Endpoints
	#authEndpoints: AuthEndpoints | null = null;
	#oauthEndpoints: OAuthEndpoints | null = null;

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
		this.#httpProvider = this.getMyProvider<IHttpServerProvider>("fastify-server");
		this.#jwtProvider = this.getMyProvider<IJWTProviderMultiKey>("security/jwt");
		this.#identityService = this.getMyService<IdentityManagerService>("IdentityManagerService");

		// Redis es opcional - funciona con fallback en memoria
		try {
			this.#redis = this.getMyProvider<IRedisProvider>("queue/redis");
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
		const isProd = process.env.NODE_ENV === "production";
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

		// Crear instancias de endpoints
		this.#authEndpoints = new AuthEndpoints(
			{
				keyStore: this.#keyStore,
				tokenService: this.#tokenService,
				refreshTokenRepo: this.#refreshTokenRepo,
				loginTracker: this.#loginTracker,
				geoValidator: this.#geoValidator,
				identityService: this.#identityService,
				cookieDomain: this.#cookieDomain,
				defaultRedirectUrl: this.#defaultRedirectUrl,
				logger: this.logger,
			},
			(username, password) => this.#validatePlatformCredentials(username, password)
		);

		this.#oauthEndpoints = new OAuthEndpoints({
			tokenService: this.#tokenService,
			geoValidator: this.#geoValidator,
			sessionManager: this.#sessionManager,
			oauthRegistry: this.#oauthRegistry,
			identityService: this.#identityService,
			cookieDomain: this.#cookieDomain,
			defaultRedirectUrl: this.#defaultRedirectUrl,
			getProviderConfig: (provider) => this.#getProviderConfig(provider),
			logger: this.logger,
		});
	}

	#registerEndpoints(): void {
		if (!this.#httpProvider || !this.#authEndpoints || !this.#oauthEndpoints) return;

		// OAuth endpoints
		this.#httpProvider.registerRoute("GET", "/api/auth/login/:provider", (req: any, res: any) =>
			this.#oauthEndpoints!.handleLogin(req, res)
		);
		this.#httpProvider.registerRoute("GET", "/api/auth/callback/:provider", (req: any, res: any) =>
			this.#oauthEndpoints!.handleCallback(req, res)
		);

		// Auth nativo endpoints
		this.#httpProvider.registerRoute("POST", "/api/auth/login", (req: any, res: any) => this.#authEndpoints!.handleNativeLogin(req, res));
		this.#httpProvider.registerRoute("POST", "/api/auth/register", (req: any, res: any) => this.#authEndpoints!.handleRegister(req, res));
		this.#httpProvider.registerRoute("GET", "/api/auth/session", (req: any, res: any) => this.#authEndpoints!.handleSession(req, res));
		this.#httpProvider.registerRoute("POST", "/api/auth/refresh", (req: any, res: any) => this.#authEndpoints!.handleRefresh(req, res));
		this.#httpProvider.registerRoute("POST", "/api/auth/logout", (req: any, res: any) => this.#authEndpoints!.handleLogout(req, res));
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
