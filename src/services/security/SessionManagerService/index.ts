import { BaseService } from "../../BaseService.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import type IdentityManagerService from "../../core/IdentityManagerService/index.js";
import type { IJWTProvider } from "../../../providers/security/jwt/index.js";
import { OAuthProviderRegistry, PlatformAuthProvider } from "./domain/oauth/index.js";
import { SessionManager } from "./domain/session/manager.js";
import type { AuthenticatedUser, AuthRequest, AuthReply, OAuthProviderConfig, SessionData, TokenVerificationResult } from "./types.js";

// Re-exportar tipos
export type { AuthenticatedUser, SessionData, TokenVerificationResult };

/**
 * Nombre de la cookie de sesión
 */
const SESSION_COOKIE_NAME = "__Secure-app.session-token";
const STATE_COOKIE_NAME = "oauth_state";

/**
 * SessionManagerService - Gestión de autenticación y sesiones
 *
 * Endpoints:
 * - GET /api/auth/login/:provider - Inicia el proceso de login OAuth
 * - GET /api/auth/callback/:provider - Callback del proveedor OAuth
 * - GET /api/auth/session - Verifica la sesión activa
 * - POST /api/auth/logout - Destruye la sesión
 */
export default class SessionManagerService extends BaseService {
	public readonly name = "SessionManagerService";

	#httpProvider: IHttpServerProvider | null = null;
	#identityService: IdentityManagerService | null = null;
	#jwtProvider: IJWTProvider | null = null;
	#sessionManager: SessionManager | null = null;
	#oauthRegistry: OAuthProviderRegistry | null = null;

	/** URL por defecto para redirección post-login */
	#defaultRedirectUrl = "https://adigitalcafe.com";

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		// Obtener providers necesarios
		this.#httpProvider = this.kernel.getProvider<IHttpServerProvider>("fastify-server");
		this.#jwtProvider = this.kernel.getProvider<IJWTProvider>("security/jwt");
		this.#identityService = this.kernel.getService<IdentityManagerService>("IdentityManagerService");

		if (!this.#httpProvider) {
			throw new Error("SessionManagerService requiere http-server-provider");
		}

		if (!this.#jwtProvider) {
			throw new Error("SessionManagerService requiere jwt provider");
		}

		// Inicializar SessionManager
		this.#sessionManager = new SessionManager({
			jwtProvider: this.#jwtProvider,
			cookieConfig: {
				name: SESSION_COOKIE_NAME,
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
			},
			stateExpiration: 10 * 60 * 1000, // 10 minutos
		});

		// Inicializar registro de OAuth providers
		this.#oauthRegistry = new OAuthProviderRegistry();

		// Registrar provider de plataforma
		this.#oauthRegistry.register(
			new PlatformAuthProvider(async (username, password) => {
				return this.#validatePlatformCredentials(username, password);
			})
		);

		// Registrar endpoints
		this.#registerEndpoints();

		this.logger.logOk("SessionManagerService iniciado");
	}

	/**
	 * Registra los endpoints de autenticación
	 */
	#registerEndpoints(): void {
		if (!this.#httpProvider) return;

		// GET /api/auth/login/:provider
		this.#httpProvider.registerRoute("GET", "/api/auth/login/:provider", async (req: any, res: any) => {
			await this.#handleLogin(req, res);
		});

		// GET /api/auth/callback/:provider
		this.#httpProvider.registerRoute("GET", "/api/auth/callback/:provider", async (req: any, res: any) => {
			await this.#handleCallback(req, res);
		});

		// GET /api/auth/session
		this.#httpProvider.registerRoute("GET", "/api/auth/session", async (req: any, res: any) => {
			await this.#handleSession(req, res);
		});

		// POST /api/auth/logout
		this.#httpProvider.registerRoute("POST", "/api/auth/logout", async (req: any, res: any) => {
			await this.#handleLogout(req, res);
		});

		// POST /api/auth/login - Login nativo con username/password
		this.#httpProvider.registerRoute("POST", "/api/auth/login", async (req: any, res: any) => {
			await this.#handleNativeLogin(req, res);
		});
	}

	/**
	 * GET /api/auth/login/:provider - Inicia el proceso de login
	 */
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

		// Generar state para CSRF protection
		const state = this.#sessionManager!.generateState();

		// Guardar state en cookie segura
		res.setCookie(STATE_COOKIE_NAME, state, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 600, // 10 minutos
		});

		// Generar URL de autorización y redirigir
		const authUrl = oauthProvider.getAuthorizationUrl(state, config);
		res.redirect(authUrl);
	}

	/**
	 * GET /api/auth/callback/:provider - Callback del proveedor OAuth
	 */
	async #handleCallback(req: AuthRequest, res: AuthReply): Promise<void> {
		const provider = req.params?.provider || "platform";
		const { code, state, error, error_description } = req.query || {};

		// Manejar errores del proveedor
		if (error) {
			this.logger.logError(`OAuth error de ${provider}: ${error} - ${error_description}`);
			res.redirect(`/auth/error?error=${encodeURIComponent(error_description || error)}`);
			return;
		}

		// Verificar code y state
		if (!code || !state) {
			res.status(400).send({ error: "Parámetros code o state faltantes" });
			return;
		}

		// Verificar state contra cookie
		const cookieState = req.cookies?.[STATE_COOKIE_NAME];
		if (!this.#sessionManager!.validateState(state, cookieState || "")) {
			res.status(403).send({ error: "State inválido - posible ataque CSRF" });
			return;
		}

		// Limpiar cookie de state
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

			// Intercambiar código por token
			const tokens = await oauthProvider.exchangeCode(code, config);

			// Obtener perfil del usuario
			const profile = await oauthProvider.getUserProfile(tokens.accessToken);

			// Gestionar usuario en la base de datos
			const user = await this.#getOrCreateUser(provider, profile);

			// Crear token de sesión
			const sessionToken = await this.#sessionManager!.createSessionToken(user);

			// Establecer cookie de sesión
			const cookieConfig = this.#sessionManager!.getCookieConfig();
			res.setCookie(cookieConfig.name, sessionToken, {
				httpOnly: cookieConfig.httpOnly,
				secure: cookieConfig.secure,
				sameSite: cookieConfig.sameSite,
				path: cookieConfig.path,
				maxAge: cookieConfig.maxAge,
			});

			// Determinar URL de redirección
			const redirectUrl = this.#getRedirectUrl(user);
			res.redirect(redirectUrl);
		} catch (err: any) {
			this.logger.logError(`Error en callback de ${provider}: ${err.message}`);
			res.redirect(`/auth/error?error=${encodeURIComponent("Error durante la autenticación")}`);
		}
	}

	/**
	 * GET /api/auth/session - Verifica la sesión activa
	 */
	async #handleSession(req: AuthRequest, res: AuthReply): Promise<void> {
		const token = req.cookies?.[SESSION_COOKIE_NAME];

		if (!token) {
			res.status(401).send({ authenticated: false, error: "No hay sesión activa" });
			return;
		}

		const result = await this.#sessionManager!.verifyToken(token);

		if (!result.valid || !result.session) {
			res.status(401).send({ authenticated: false, error: result.error });
			return;
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

	/**
	 * POST /api/auth/logout - Destruye la sesión
	 */
	async #handleLogout(_req: AuthRequest, res: AuthReply): Promise<void> {
		const cookieConfig = this.#sessionManager!.getCookieConfig();

		// Limpiar cookie de sesión
		res.clearCookie(cookieConfig.name, {
			path: cookieConfig.path,
		});

		res.send({ success: true, message: "Sesión cerrada" });
	}

	/**
	 * POST /api/auth/login - Login nativo con username/password
	 */
	async #handleNativeLogin(req: any, res: AuthReply): Promise<void> {
		const { username, password } = req.body || {};

		if (!username || !password) {
			res.status(400).send({ error: "Username y password son requeridos" });
			return;
		}

		try {
			// Validar credenciales
			const profile = await this.#validatePlatformCredentials(username, password);

			if (!profile) {
				res.status(401).send({ error: "Credenciales inválidas" });
				return;
			}

			// Obtener o crear usuario autenticado
			const user = await this.#getOrCreateUser("platform", {
				id: profile.id,
				username: profile.username,
				email: profile.email,
			});

			// Crear token de sesión
			const sessionToken = await this.#sessionManager!.createSessionToken(user);

			// Establecer cookie de sesión
			const cookieConfig = this.#sessionManager!.getCookieConfig();
			res.setCookie(cookieConfig.name, sessionToken, {
				httpOnly: cookieConfig.httpOnly,
				secure: cookieConfig.secure,
				sameSite: cookieConfig.sameSite,
				path: cookieConfig.path,
				maxAge: cookieConfig.maxAge,
			});

			res.send({
				success: true,
				token: sessionToken,
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

	/**
	 * Verifica si un token es válido (función pública para otros servicios)
	 */
	async verifyToken(token: string): Promise<TokenVerificationResult> {
		if (!this.#sessionManager) {
			return { valid: false, error: "SessionManagerService no inicializado" };
		}
		return this.#sessionManager.verifyToken(token);
	}

	/**
	 * Extrae el token de sesión de una request
	 */
	extractSessionToken(req: { cookies?: Record<string, string> }): string | null {
		return req.cookies?.[SESSION_COOKIE_NAME] || null;
	}

	/**
	 * Obtiene la configuración de un proveedor OAuth
	 */
	#getProviderConfig(provider: string): OAuthProviderConfig | null {
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";

		const configs: Record<string, OAuthProviderConfig> = {
			discord: {
				clientId: process.env.DISCORD_CLIENT_ID || "",
				clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
				redirectUri: `${baseUrl}/api/auth/callback/discord`,
				scopes: ["identify", "email"],
			},
			google: {
				clientId: process.env.GOOGLE_CLIENT_ID || "",
				clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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

	/**
	 * Obtiene o crea un usuario en la base de datos
	 * El provider ID se guarda en metadata.{provider}Id (ej: metadata.discordId)
	 */
	async #getOrCreateUser(
		provider: string,
		profile: { id: string; username: string; email?: string; avatar?: string }
	): Promise<AuthenticatedUser> {
		let user: AuthenticatedUser | null = null;

		// Campo en metadata donde se guarda el ID del provider (ej: discordId, googleId)
		const providerIdField = `${provider}Id`;

		if (this.#identityService) {
			const users = this.#identityService.users;

			// Buscar usuario por metadata.{provider}Id o por email
			const allUsers = await users.getAllUsers();
			let existingUser = allUsers.find(
				(u: any) => u.metadata?.[providerIdField] === profile.id || (profile.email && u.email === profile.email)
			);

			if (existingUser) {
				// Si encontramos por email pero no tiene el provider vinculado, vincularlo
				if (!existingUser.metadata?.[providerIdField]) {
					const updatedMetadata = { ...existingUser.metadata, [providerIdField]: profile.id };
					await users.updateUser(existingUser.id, { metadata: updatedMetadata });
					existingUser = { ...existingUser, metadata: updatedMetadata };
				}

				// Obtener permisos del usuario
				const permissions = await this.#getUserPermissions(existingUser.id);
				user = {
					id: existingUser.id,
					providerId: profile.id,
					provider,
					username: existingUser.username,
					email: existingUser.email,
					avatar: profile.avatar || existingUser.metadata?.avatar,
					permissions,
					metadata: existingUser.metadata,
				};
			} else {
				// Crear nuevo usuario con el provider ID en metadata
				// Generar un password aleatorio ya que usa OAuth
				const randomPassword = Math.random().toString(36).slice(-16);
				const newUser = await users.createUser(profile.username, randomPassword, []);

				// Actualizar con metadata del provider
				await users.updateUser(newUser.id, {
					email: profile.email,
					metadata: {
						[providerIdField]: profile.id,
						avatar: profile.avatar,
						createdVia: provider,
					},
				});

				// Asignar permisos por defecto
				const defaultPermissions = await this.#getDefaultPermissions();
				user = {
					id: newUser.id,
					providerId: profile.id,
					provider,
					username: newUser.username,
					email: profile.email,
					avatar: profile.avatar,
					permissions: defaultPermissions,
				};
			}
		} else {
			// Sin IdentityService, crear usuario temporal
			user = {
				id: `temp_${profile.id}`,
				providerId: profile.id,
				provider,
				username: profile.username,
				email: profile.email,
				avatar: profile.avatar,
				permissions: ["public.read"],
			};
		}

		return user;
	}

	/**
	 * Obtiene los permisos de un usuario
	 */
	async #getUserPermissions(userId: string): Promise<string[]> {
		if (!this.#identityService) {
			return ["public.read"];
		}

		try {
			const permissions = this.#identityService.permissions;
			const resolved = await permissions.resolvePermissions(userId);
			return resolved.map((p: { resource: string; scope: number; action: number }) => `${p.resource}.${p.scope}.${p.action}`);
		} catch {
			return ["public.read"];
		}
	}

	/**
	 * Obtiene los permisos por defecto para nuevos usuarios
	 */
	async #getDefaultPermissions(): Promise<string[]> {
		// Permisos básicos para usuarios nuevos
		return ["public.read", "profile.self.read", "profile.self.write"];
	}

	/**
	 * Determina la URL de redirección post-login
	 */
	#getRedirectUrl(user: AuthenticatedUser): string {
		// Si el usuario tiene una organización, redirigir al home de la org
		if (user.orgId) {
			return `https://${user.orgId}.adigitalcafe.com`;
		}
		return this.#defaultRedirectUrl;
	}

	/**
	 * Valida credenciales de la plataforma usando UserManager.authenticate
	 */
	async #validatePlatformCredentials(username: string, password: string): Promise<{ id: string; username: string; email?: string } | null> {
		if (!this.#identityService) {
			return null;
		}

		try {
			const users = this.#identityService.users;
			const user = await users.authenticate(username, password);
			if (user) {
				return {
					id: user.id,
					username: user.username,
					email: user.email,
				};
			}
			return null;
		} catch {
			return null;
		}
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		this.#sessionManager = null;
		this.#oauthRegistry = null;
		this.logger.logDebug("SessionManagerService detenido");
	}
}
