import type { AuthRequest, AuthReply, AuthenticatedUser, OAuthProviderConfig } from "../types.js";
import type { TokenService } from "../domain/tokens/TokenService.js";
import type { GeoIPValidator } from "../domain/security/GeoIPValidator.js";
import type { SessionManager } from "../domain/session/manager.js";
import type { OAuthProviderRegistry } from "../domain/oauth/index.js";
import type IdentityManagerService from "../../../core/IdentityManagerService/index.js";

/** Nombre de las cookies */
const STATE_COOKIE_NAME = "oauth_state";
const ORIGIN_PATH_COOKIE_NAME = "oauth_origin_path";

const isProd = process.env.NODE_ENV === "production";

export interface OAuthEndpointsDeps {
	tokenService: TokenService;
	geoValidator: GeoIPValidator;
	sessionManager: SessionManager;
	oauthRegistry: OAuthProviderRegistry;
	identityService: IdentityManagerService | null;
	cookieDomain: string;
	defaultRedirectUrl: string;
	getProviderConfig: (provider: string) => OAuthProviderConfig | null;
	logger: { logError: (msg: string) => void; logWarn: (msg: string) => void };
}

/**
 * Endpoints de autenticación OAuth (Discord, Google, etc.)
 */
export class OAuthEndpoints {
	#deps: OAuthEndpointsDeps;

	constructor(deps: OAuthEndpointsDeps) {
		this.#deps = deps;
	}

	/**
	 * GET /api/auth/login/:provider - Iniciar flujo OAuth
	 */
	async handleLogin(req: AuthRequest, res: AuthReply): Promise<void> {
		const provider = req.params?.provider || "platform";

		if (!this.#deps.oauthRegistry.has(provider)) {
			res.status(400).send({ error: `Proveedor '${provider}' no soportado` });
			return;
		}

		const oauthProvider = this.#deps.oauthRegistry.get(provider)!;
		const config = this.#deps.getProviderConfig(provider);

		if (!config) {
			res.status(500).send({ error: `Configuración del proveedor '${provider}' no encontrada` });
			return;
		}

		// Capturar originPath de query params para redirect post-auth
		const originPath = (req.query as { originPath?: string })?.originPath || "/";

		// Generar state para CSRF protection
		const state = this.#deps.sessionManager.generateState();

		// Guardar state en cookie segura
		res.setCookie(STATE_COOKIE_NAME, state, {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 10 * 60, // 10 minutos
		});

		// Guardar originPath en cookie separada
		if (originPath && originPath !== "/") {
			res.setCookie(ORIGIN_PATH_COOKIE_NAME, originPath, {
				httpOnly: true,
				secure: isProd,
				sameSite: "lax",
				path: "/",
				maxAge: 10 * 60,
			});
		}

		const authUrl = oauthProvider.getAuthorizationUrl(state, config);
		res.redirect(authUrl);
	}

	/**
	 * GET /api/auth/callback/:provider - Callback OAuth
	 */
	async handleCallback(req: AuthRequest, res: AuthReply): Promise<void> {
		const provider = req.params?.provider || "platform";
		const query = req.query as { code?: string; state?: string; error?: string };
		const { code, state, error } = query;

		if (error) {
			res.redirect(`/auth/error?error=${encodeURIComponent(error)}`);
			return;
		}

		if (!code || !state) {
			res.redirect("/auth/error?error=Código o estado faltante");
			return;
		}

		// Validar state contra la cookie
		const stateCookie = req.cookies?.[STATE_COOKIE_NAME];
		if (!stateCookie) {
			res.redirect("/auth/error?error=Estado faltante en cookies");
			return;
		}

		// Usar el método validateState con ambos argumentos
		const stateValid = this.#deps.sessionManager.validateState(state, stateCookie);
		if (!stateValid) {
			res.redirect("/auth/error?error=Estado inválido (posible ataque CSRF)");
			return;
		}

		// Limpiar cookie de state
		res.clearCookie(STATE_COOKIE_NAME, { path: "/" });

		// Obtener originPath de la cookie
		const originPath = req.cookies?.[ORIGIN_PATH_COOKIE_NAME] || "/";
		res.clearCookie(ORIGIN_PATH_COOKIE_NAME, { path: "/" });

		const oauthProvider = this.#deps.oauthRegistry.get(provider);
		if (!oauthProvider) {
			res.redirect("/auth/error?error=Proveedor no encontrado");
			return;
		}

		const config = this.#deps.getProviderConfig(provider);
		if (!config) {
			res.status(500).send({ error: "Configuración del proveedor no encontrada" });
			return;
		}

		try {
			const tokens = await oauthProvider.exchangeCode(code, config);
			const profile = await oauthProvider.getUserProfile(tokens.accessToken);
			const user = await this.#getOrCreateUser(provider, profile);

			await this.#issueTokens(req, res, user);

			// Redirigir al originPath o al default
			const redirectUrl = this.#getRedirectUrl(user, originPath);
			res.redirect(redirectUrl);
		} catch (err: any) {
			this.#deps.logger.logError(`Error en callback de ${provider}: ${err.message}`);
			res.redirect(`/auth/error?error=${encodeURIComponent("Error durante la autenticación")}`);
		}
	}

	// ============ Métodos auxiliares ============

	async #issueTokens(req: AuthRequest, res: AuthReply, user: AuthenticatedUser): Promise<void> {
		const ipAddress = this.#deps.geoValidator.extractRealIP(req.headers, req.ip);
		const country = this.#deps.geoValidator.getCountryFromHeaders(req.headers);
		const deviceId = this.#generateDeviceId(req);
		const userAgent = req.headers["user-agent"]?.toString() || "unknown";

		const tokens = await this.#deps.tokenService.createTokenPair(user, deviceId, ipAddress, country, userAgent);
		this.#setTokenCookies(res, tokens.accessToken, tokens.refreshToken.token);
	}

	#setTokenCookies(res: AuthReply, accessToken: string, refreshToken: string): void {
		const accessConfig = this.#deps.tokenService.getAccessCookieConfig();
		const refreshConfig = this.#deps.tokenService.getRefreshCookieConfig();

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

	#getRedirectUrl(user: AuthenticatedUser, originPath?: string): string {
		const baseUrl = user.orgId ? `https://${user.orgId}.adigitalcafe.com` : this.#deps.defaultRedirectUrl;

		if (originPath && originPath !== "/") {
			return `${baseUrl}${originPath}`;
		}

		return baseUrl;
	}

	async #getOrCreateUser(
		provider: string,
		profile: { id: string; username: string; email?: string; avatar?: string }
	): Promise<AuthenticatedUser> {
		if (!this.#deps.identityService) {
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
		const users = this.#deps.identityService.users;
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

	async #getUserPermissions(userId: string): Promise<string[]> {
		if (!this.#deps.identityService) return ["public.read"];

		try {
			const permissions = this.#deps.identityService.permissions;
			const resolved = await permissions.resolvePermissions(userId);
			return resolved.map((p: { resource: string; scope: number; action: number }) => `${p.resource}.${p.scope}.${p.action}`);
		} catch {
			return ["public.read"];
		}
	}

	async #getDefaultPermissions(): Promise<string[]> {
		return ["public.read", "profile.self.read", "profile.self.write"];
	}
}
