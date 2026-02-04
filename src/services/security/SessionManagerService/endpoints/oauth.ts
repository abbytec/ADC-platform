import type { TokenService } from "../domain/tokens/TokenService.js";
import type { GeoIPValidator } from "../domain/security/GeoIPValidator.js";
import type { SessionManager } from "../domain/session/manager.js";
import type { OAuthProviderRegistry } from "../domain/oauth/index.js";
import type IdentityManagerService from "../../../core/IdentityManagerService/index.js";
import {
	RegisterEndpoint,
	UncommonResponse,
	type EndpointCtx,
	type SetCookie,
	type ClearCookie,
} from "../../../core/EndpointManagerService/index.js";
import { AuthError } from "@common/types/custom-errors/AuthError.ts";
import type { AuthenticatedUser, OAuthProviderConfig } from "../types.js";

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

interface ProviderParams {
	provider: string;
}

/**
 * Endpoints de autenticación OAuth (Discord, Google, etc.)
 * Singleton con métodos estáticos y @RegisterEndpoint
 */
export class OAuthEndpoints {
	private static deps: OAuthEndpointsDeps;

	static init(deps: OAuthEndpointsDeps): void {
		OAuthEndpoints.deps ??= deps;
	}

	/**
	 * GET /api/auth/login/:provider - Iniciar flujo OAuth
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/auth/login/:provider",
		permissions: [],
	})
	static async handleLogin(ctx: EndpointCtx<ProviderParams>): Promise<never> {
		const provider = ctx.params.provider || "platform";

		if (!OAuthEndpoints.deps.oauthRegistry.has(provider)) {
			throw new AuthError(400, "PROVIDER_NOT_SUPPORTED", `Proveedor '${provider}' no soportado`);
		}

		const oauthProvider = OAuthEndpoints.deps.oauthRegistry.get(provider)!;
		const config = OAuthEndpoints.deps.getProviderConfig(provider);

		if (!config) {
			throw new AuthError(500, "PROVIDER_CONFIG_NOT_FOUND", `Configuración del proveedor '${provider}' no encontrada`);
		}

		// Capturar originPath de query params para redirect post-auth
		const originPath = ctx.query?.originPath || "/";

		// Generar state para CSRF protection
		const state = OAuthEndpoints.deps.sessionManager.generateState();

		// Preparar cookies
		const cookies: SetCookie[] = [
			{
				name: STATE_COOKIE_NAME,
				value: state,
				options: {
					httpOnly: true,
					secure: isProd,
					sameSite: "lax",
					path: "/",
					maxAge: 10 * 60, // 10 minutos
				},
			},
		];

		// Guardar originPath en cookie separada si no es "/"
		if (originPath && originPath !== "/") {
			cookies.push({
				name: ORIGIN_PATH_COOKIE_NAME,
				value: originPath,
				options: {
					httpOnly: true,
					secure: isProd,
					sameSite: "lax",
					path: "/",
					maxAge: 10 * 60,
				},
			});
		}

		const authUrl = oauthProvider.getAuthorizationUrl(state, config);
		throw UncommonResponse.redirect(authUrl, { status: 302, cookies });
	}

	/**
	 * GET /api/auth/callback/:provider - Callback OAuth
	 */
	@RegisterEndpoint({
		method: "GET",
		url: "/api/auth/callback/:provider",
		permissions: [],
	})
	static async handleCallback(ctx: EndpointCtx<ProviderParams>): Promise<never> {
		const provider = ctx.params.provider || "platform";
		const { code, state, error } = ctx.query || {};

		// Cookies a limpiar (siempre limpiar state cookies)
		const clearCookies: ClearCookie[] = [
			{ name: STATE_COOKIE_NAME, options: { path: "/" } },
			{ name: ORIGIN_PATH_COOKIE_NAME, options: { path: "/" } },
		];

		if (error) {
			throw UncommonResponse.redirect(`/auth/error?error=${encodeURIComponent(error)}`, {
				status: 302,
				clearCookies,
			});
		}

		if (!code || !state) {
			throw UncommonResponse.redirect("/auth/error?error=Código o estado faltante", {
				status: 302,
				clearCookies,
			});
		}

		// Validar state contra la cookie
		const stateCookie = ctx.cookies?.[STATE_COOKIE_NAME];
		if (!stateCookie) {
			throw UncommonResponse.redirect("/auth/error?error=Estado faltante en cookies", {
				status: 302,
				clearCookies,
			});
		}

		// Usar el método validateState con ambos argumentos
		const stateValid = OAuthEndpoints.deps.sessionManager.validateState(state, stateCookie);
		if (!stateValid) {
			throw UncommonResponse.redirect("/auth/error?error=Estado inválido (posible ataque CSRF)", {
				status: 302,
				clearCookies,
			});
		}

		// Obtener originPath de la cookie
		const originPath = ctx.cookies?.[ORIGIN_PATH_COOKIE_NAME] || "/";

		const oauthProvider = OAuthEndpoints.deps.oauthRegistry.get(provider);
		if (!oauthProvider) {
			throw UncommonResponse.redirect("/auth/error?error=Proveedor no encontrado", {
				status: 302,
				clearCookies,
			});
		}

		const config = OAuthEndpoints.deps.getProviderConfig(provider);
		if (!config) {
			throw new AuthError(500, "PROVIDER_CONFIG_NOT_FOUND", "Configuración del proveedor no encontrada");
		}

		try {
			const tokens = await oauthProvider.exchangeCode(code, config);
			const profile = await oauthProvider.getUserProfile(tokens.accessToken);
			const user = await OAuthEndpoints.getOrCreateUser(provider, profile);

			const tokenCookies = await OAuthEndpoints.getTokenCookies(ctx, user);

			// Redirigir al originPath o al default
			const redirectUrl = OAuthEndpoints.getRedirectUrl(user, originPath);
			throw UncommonResponse.redirect(redirectUrl, {
				status: 302,
				cookies: tokenCookies,
				clearCookies,
			});
		} catch (err: any) {
			// Si ya es un UncommonResponse o AuthError, re-lanzar
			if (err instanceof UncommonResponse || err instanceof AuthError) throw err;

			OAuthEndpoints.deps.logger.logError(`Error en callback de ${provider}: ${err.message}`);
			throw UncommonResponse.redirect(`/auth/error?error=${encodeURIComponent("Error durante la autenticación")}`, {
				status: 302,
				clearCookies,
			});
		}
	}

	// ============ Métodos auxiliares (privados estáticos) ============

	private static async getTokenCookies(ctx: EndpointCtx<ProviderParams>, user: AuthenticatedUser): Promise<SetCookie[]> {
		const ipAddress = OAuthEndpoints.deps.geoValidator.extractRealIP(ctx.headers, ctx.ip);
		const country = OAuthEndpoints.deps.geoValidator.getCountryFromHeaders(ctx.headers);
		const deviceId = OAuthEndpoints.generateDeviceId(ctx.headers);
		const userAgent = ctx.headers["user-agent"]?.toString() || "unknown";

		const tokens = await OAuthEndpoints.deps.tokenService.createTokenPair(user, deviceId, ipAddress, country, userAgent);

		const accessConfig = OAuthEndpoints.deps.tokenService.getAccessCookieConfig();
		const refreshConfig = OAuthEndpoints.deps.tokenService.getRefreshCookieConfig();

		return [
			{
				name: accessConfig.name,
				value: tokens.accessToken,
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
				value: tokens.refreshToken.token,
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

	private static getRedirectUrl(user: AuthenticatedUser, originPath?: string): string {
		const baseUrl = user.orgId ? `https://${user.orgId}.adigitalcafe.com` : OAuthEndpoints.deps.defaultRedirectUrl;

		if (originPath && originPath !== "/") {
			return `${baseUrl}${originPath}`;
		}

		return baseUrl;
	}

	private static async getOrCreateUser(
		provider: string,
		profile: { id: string; username: string; email?: string; avatar?: string }
	): Promise<AuthenticatedUser> {
		if (!OAuthEndpoints.deps.identityService) {
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
		const users = OAuthEndpoints.deps.identityService.users;
		let existingUser = await users.findByProviderIdOrEmail(providerIdField, profile.id, profile.email);

		if (existingUser) {
			if (!existingUser.metadata?.[providerIdField]) {
				const updatedMetadata = { ...existingUser.metadata, [providerIdField]: profile.id };
				await users.updateUser(existingUser.id, { metadata: updatedMetadata });
				existingUser = { ...existingUser, metadata: updatedMetadata };
			}

			const permissions = await OAuthEndpoints.getUserPermissions(existingUser.id);
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

		const defaultPermissions = await OAuthEndpoints.getDefaultPermissions();
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

	private static async getUserPermissions(userId: string): Promise<string[]> {
		if (!OAuthEndpoints.deps.identityService) return ["public.read"];

		try {
			const permissions = OAuthEndpoints.deps.identityService.permissions;
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
