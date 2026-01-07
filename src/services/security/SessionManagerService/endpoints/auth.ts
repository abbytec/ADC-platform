import type { AuthRequest, AuthReply, AuthenticatedUser } from "../types.js";
import type { KeyStore } from "../domain/keys/KeyStore.js";
import type { TokenService } from "../domain/tokens/TokenService.js";
import type { RefreshTokenRepository } from "../domain/tokens/RefreshTokenRepository.js";
import type { LoginAttemptTracker } from "../domain/security/LoginAttemptTracker.js";
import type { GeoIPValidator } from "../domain/security/GeoIPValidator.js";
import type IdentityManagerService from "../../../core/IdentityManagerService/index.js";

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

/**
 * Endpoints de autenticación nativa (usuario/contraseña)
 */
export class AuthEndpoints {
	#deps: AuthEndpointsDeps;
	#validateCredentials: (username: string, password: string) => Promise<{ id: string; username: string; email?: string } | null>;

	constructor(
		deps: AuthEndpointsDeps,
		validateCredentials: (username: string, password: string) => Promise<{ id: string; username: string; email?: string } | null>
	) {
		this.#deps = deps;
		this.#validateCredentials = validateCredentials;
	}

	/**
	 * POST /api/auth/login - Login con usuario/contraseña
	 */
	async handleNativeLogin(req: AuthRequest, res: AuthReply): Promise<void> {
		const body = (req.body || {}) as { username?: string; password?: string };
		const { username, password } = body;

		if (!username || !password) {
			res.status(400).send({ error: "Username y password son requeridos" });
			return;
		}

		try {
			const profile = await this.#validateCredentials(username, password);

			if (!profile) {
				const tempUserId = `login_attempt_${username}`;
				const blockStatus = await this.#deps.loginTracker.recordLoginAttempt(tempUserId, false, req.ip);

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

			const blockStatus = await this.#deps.loginTracker.isBlocked(user.id);
			if (blockStatus.blocked) {
				res.status(403).send({
					error: blockStatus.permanent ? "Cuenta bloqueada" : "Cuenta bloqueada temporalmente",
					blockedUntil: blockStatus.blockedUntil,
					permanent: blockStatus.permanent,
				});
				return;
			}

			await this.#deps.loginTracker.recordLoginAttempt(user.id, true, req.ip);
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
			this.#deps.logger.logError(`Error en login nativo: ${err.message}`);
			res.status(500).send({ error: "Error durante la autenticación" });
		}
	}

	/**
	 * POST /api/auth/register - Registro de nuevo usuario
	 */
	async handleRegister(req: AuthRequest, res: AuthReply): Promise<void> {
		const body = (req.body || {}) as { username?: string; email?: string; password?: string };
		const { username, email, password } = body;

		if (!username || !email || !password) {
			res.status(400).send({ error: "Username, email y password son requeridos" });
			return;
		}

		// Validaciones básicas
		if (username.length < 3 || username.length > 30) {
			res.status(400).send({ error: "El nombre de usuario debe tener entre 3 y 30 caracteres" });
			return;
		}

		if (password.length < 8) {
			res.status(400).send({ error: "La contraseña debe tener al menos 8 caracteres" });
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			res.status(400).send({ error: "El email no es válido" });
			return;
		}

		if (!this.#deps.identityService) {
			res.status(500).send({ error: "Servicio de identidad no disponible" });
			return;
		}

		try {
			// Verificar si el usuario o email ya existe
			const users = this.#deps.identityService.users;
			const allUsers = await users.getAllUsers();
			const existingUsername = allUsers.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
			const existingEmail = allUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

			if (existingUsername) {
				res.status(409).send({ error: "El nombre de usuario ya está en uso" });
				return;
			}

			if (existingEmail) {
				res.status(409).send({ error: "El email ya está registrado" });
				return;
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
			const user = await this.#getOrCreateUser("platform", {
				id: newUser.id,
				username,
				email,
			});

			// Emitir tokens (login automático tras registro)
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
			this.#deps.logger.logError(`Error en registro: ${err.message}`);
			res.status(500).send({ error: "Error al crear la cuenta" });
		}
	}

	/**
	 * GET /api/auth/session - Verificar sesión actual
	 */
	async handleSession(req: AuthRequest, res: AuthReply): Promise<void> {
		const token = req.cookies?.[ACCESS_COOKIE_NAME];

		if (!token) {
			res.status(401).send({ authenticated: false, error: "No hay sesión activa" });
			return;
		}

		const result = await this.#deps.tokenService.verifyAccessToken(token);

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

	/**
	 * POST /api/auth/refresh - Refrescar tokens
	 */
	async handleRefresh(req: AuthRequest, res: AuthReply): Promise<void> {
		const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

		if (!refreshToken) {
			res.status(401).send({ error: "No hay refresh token" });
			return;
		}

		const storedToken = await this.#deps.refreshTokenRepo.findByToken(refreshToken);

		if (!storedToken) {
			res.status(401).send({ error: "Refresh token inválido" });
			return;
		}

		// Validar cambio de país usando Cloudflare headers
		const currentCountry = this.#deps.geoValidator.getCountryFromHeaders(req.headers);
		const geoValidation = this.#deps.geoValidator.validateLocationChange(currentCountry, storedToken.country);

		if (!geoValidation.valid) {
			await this.#deps.tokenService.revokeAllUserTokens(storedToken.userId);
			this.#deps.logger.logWarn(`Cambio de país detectado para usuario ${storedToken.userId}: ${geoValidation.reason}`);

			res.status(401).send({
				error: "Sesión invalidada por cambio de ubicación",
				requireRelogin: true,
			});
			return;
		}

		const refreshAttempt = await this.#deps.loginTracker.recordRefreshAttempt(storedToken.userId, true);

		if (refreshAttempt.blocked) {
			if (refreshAttempt.shouldDeleteTokens) {
				await this.#deps.tokenService.deleteAllUserTokens(storedToken.userId);
			}

			res.status(403).send({
				error: "Cuenta bloqueada por actividad sospechosa",
				permanent: refreshAttempt.status.permanent,
			});
			return;
		}

		const ipAddress = this.#deps.geoValidator.extractRealIP(req.headers, req.ip);
		const result = await this.#deps.tokenService.refreshTokens(
			refreshToken,
			ipAddress,
			currentCountry,
			req.headers["user-agent"]?.toString() || "unknown",
			async (userId) => this.#getUserById(userId)
		);

		if (!result.success || !result.tokens) {
			const failResult = await this.#deps.loginTracker.recordRefreshAttempt(storedToken.userId, false);

			if (failResult.blocked && failResult.shouldDeleteTokens) {
				await this.#deps.tokenService.deleteAllUserTokens(storedToken.userId);
			}

			res.status(401).send({ error: result.error || "Error al refrescar tokens" });
			return;
		}

		this.#setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken.token);
		res.send({ success: true });
	}

	/**
	 * POST /api/auth/logout - Cerrar sesión
	 */
	async handleLogout(req: AuthRequest, res: AuthReply): Promise<void> {
		const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

		if (refreshToken) {
			await this.#deps.refreshTokenRepo.revoke(refreshToken);
		}

		res.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
		res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth/refresh", domain: this.#deps.cookieDomain });

		res.send({ success: true, message: "Sesión cerrada" });
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

	async #getUserById(userId: string): Promise<AuthenticatedUser | null> {
		if (!this.#deps.identityService) return null;

		try {
			const users = this.#deps.identityService.users;
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
