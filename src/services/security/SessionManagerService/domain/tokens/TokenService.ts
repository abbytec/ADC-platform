import { TokenVerificationResult } from "../../../../../providers/security/jwt/index.ts";
import type { AuthenticatedUser, SessionData } from "../../types.js";
import type { KeyStore } from "../keys/KeyStore.js";
import type { RefreshTokenRepository, StoredRefreshToken } from "./RefreshTokenRepository.js";

const isProd = process.env.NODE_ENV === "production";

/**
 * Payload del Access Token (JWT)
 * Extiende Record para ser compatible con jose.JWTPayload
 */
export interface AccessTokenPayload extends Record<string, unknown> {
	userId: string;
	permissions: string[];
	deviceId: string;
	metadata?: Record<string, unknown>;
	iat?: number;
	exp?: number;
}

/**
 * Par de tokens retornado en login
 */
export interface TokenPair {
	accessToken: string;
	refreshToken: StoredRefreshToken;
}

/**
 * Resultado de verificación de Access Token
 */
export interface AccessTokenVerificationResult extends TokenVerificationResult<AccessTokenPayload> {
	session?: SessionData;
	/** True si el token fue verificado con la clave anterior (requiere refresh) */
	usedPreviousKey?: boolean;
}

/**
 * Resultado de refresh
 */
export interface RefreshResult {
	success: boolean;
	tokens?: TokenPair;
	error?: string;
}

/**
 * Interface del JWT Provider que usamos
 * Usa Record<string, unknown> para compatibilidad con jose.JWTPayload
 */
export interface IJWTProviderMultiKey {
	encryptWithKey(payload: Record<string, unknown>, key: Uint8Array, expiresIn: string): Promise<string>;
	decryptWithKey(token: string, key: Uint8Array): Promise<{ valid: boolean; payload?: Record<string, unknown>; error?: string }>;
}

/**
 * Configuración del TokenService
 */
export interface TokenServiceConfig {
	/** Tiempo de expiración del Access Token (default: 15m) */
	accessTokenTtl: string;
	/** Tiempo de expiración del Refresh Token en segundos (default: 30 días) */
	refreshTokenTtlSeconds: number;
	/** Dominio para la cookie del refresh token */
	cookieDomain: string;
}

/**
 * TokenService - Gestión unificada de Access y Refresh Tokens
 *
 * Implementa Single Responsibility: Solo gestión de tokens
 * Implementa Open/Closed: Extensible via interfaces
 *
 * Responsabilidades:
 * - Crear pares de tokens (access + refresh)
 * - Verificar access tokens con fallback a clave anterior
 * - Refrescar tokens
 */
export class TokenService {
	#keyStore: KeyStore;
	#jwtProvider: IJWTProviderMultiKey;
	#refreshTokenRepo: RefreshTokenRepository;
	#config: TokenServiceConfig;

	constructor(keyStore: KeyStore, jwtProvider: IJWTProviderMultiKey, refreshTokenRepo: RefreshTokenRepository, config: TokenServiceConfig) {
		this.#keyStore = keyStore;
		this.#jwtProvider = jwtProvider;
		this.#refreshTokenRepo = refreshTokenRepo;
		this.#config = config;
	}

	/**
	 * Crea un par de tokens para un usuario autenticado
	 */
	async createTokenPair(
		user: AuthenticatedUser,
		deviceId: string,
		ipAddress: string,
		country: string | null,
		userAgent: string
	): Promise<TokenPair> {
		// Crear Access Token
		const accessPayload: AccessTokenPayload = {
			userId: user.id,
			permissions: user.permissions,
			deviceId,
			metadata: {
				provider: user.provider,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				orgId: user.orgId,
			},
		};

		const currentKey = this.#keyStore.getCurrentKey();
		const accessToken = await this.#jwtProvider.encryptWithKey(accessPayload, currentKey, this.#config.accessTokenTtl);

		// Crear Refresh Token
		const refreshToken = await this.#refreshTokenRepo.create({
			userId: user.id,
			deviceId,
			ipAddress,
			country,
			userAgent,
			ttlSeconds: this.#config.refreshTokenTtlSeconds,
		});

		return {
			accessToken,
			refreshToken,
		};
	}

	/**
	 * Verifica un Access Token
	 *
	 * Intenta primero con la clave actual, luego con la anterior.
	 * Si verifica con la anterior, indica que se necesita refresh.
	 */
	async verifyAccessToken(token: string): Promise<AccessTokenVerificationResult> {
		const currentKey = this.#keyStore.getCurrentKey();
		const previousKey = this.#keyStore.getPreviousKey();

		// Intentar con clave actual
		let result = await this.#jwtProvider.decryptWithKey(token, currentKey);

		if (result.valid && result.payload) {
			const payload = result.payload as AccessTokenPayload;
			return {
				valid: true,
				payload,
				session: this.#payloadToSession(payload),
				usedPreviousKey: false,
			};
		}

		// Si falló por firma y tenemos clave anterior, intentar con ella
		if (previousKey && result.error !== "Token expirado") {
			result = await this.#jwtProvider.decryptWithKey(token, previousKey);

			if (result.valid && result.payload) {
				const payload = result.payload as AccessTokenPayload;
				return {
					valid: true,
					payload,
					session: this.#payloadToSession(payload),
					usedPreviousKey: true, // Marcar que necesita refresh
				};
			}
		}

		return {
			valid: false,
			error: result.error || "Token inválido",
		};
	}

	/**
	 * Refresca los tokens usando un refresh token
	 */
	async refreshTokens(
		refreshToken: string,
		ipAddress: string,
		country: string | null,
		userAgent: string,
		getUserById: (userId: string) => Promise<AuthenticatedUser | null>
	): Promise<RefreshResult> {
		// Buscar refresh token
		const storedToken = await this.#refreshTokenRepo.findByToken(refreshToken);

		if (!storedToken) {
			return { success: false, error: "Refresh token inválido o expirado" };
		}

		// Obtener usuario actualizado
		const user = await getUserById(storedToken.userId);
		if (!user) {
			await this.#refreshTokenRepo.revoke(refreshToken);
			return { success: false, error: "Usuario no encontrado" };
		}

		// Rotar refresh token (borra el viejo, crea uno nuevo)
		const newRefreshToken = await this.#refreshTokenRepo.rotate(refreshToken, {
			ipAddress,
			country,
			userAgent,
			ttlSeconds: this.#config.refreshTokenTtlSeconds,
		});

		if (!newRefreshToken) {
			return { success: false, error: "Error al rotar refresh token" };
		}

		// Crear nuevo access token
		const accessPayload: AccessTokenPayload = {
			userId: user.id,
			permissions: user.permissions,
			deviceId: storedToken.deviceId,
			metadata: {
				provider: user.provider,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				orgId: user.orgId,
			},
		};

		const currentKey = this.#keyStore.getCurrentKey();
		const accessToken = await this.#jwtProvider.encryptWithKey(accessPayload, currentKey, this.#config.accessTokenTtl);

		return {
			success: true,
			tokens: {
				accessToken,
				refreshToken: newRefreshToken,
			},
		};
	}

	/**
	 * Revoca todos los tokens de un usuario
	 */
	async revokeAllUserTokens(userId: string): Promise<number> {
		return this.#refreshTokenRepo.revokeAllForUser(userId);
	}

	/**
	 * Elimina todos los tokens de un usuario (para bloqueo)
	 */
	async deleteAllUserTokens(userId: string): Promise<number> {
		return this.#refreshTokenRepo.deleteAllForUser(userId);
	}

	/**
	 * Obtiene la configuración de cookie para refresh token
	 */
	getRefreshCookieConfig(): {
		name: string;
		httpOnly: boolean;
		secure: boolean;
		sameSite: "strict" | "lax" | "none";
		path: string;
		maxAge: number;
		domain: string;
	} {
		return {
			name: "refresh_token",
			httpOnly: true,
			secure: isProd,
			sameSite: "strict",
			path: "/api/auth/refresh",
			maxAge: this.#config.refreshTokenTtlSeconds,
			domain: this.#config.cookieDomain,
		};
	}

	/**
	 * Obtiene la configuración de cookie para access token
	 */
	getAccessCookieConfig(): {
		name: string;
		httpOnly: boolean;
		secure: boolean;
		sameSite: "strict" | "lax" | "none";
		path: string;
		maxAge: number;
	} {
		// Access token expira en 15 minutos = 900 segundos
		return {
			name: "access_token",
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 900, // 15 minutos
		};
	}

	/**
	 * Convierte payload a SessionData
	 */
	#payloadToSession(payload: AccessTokenPayload): SessionData {
		return {
			user: {
				id: payload.userId,
				provider: (payload.metadata?.provider as string) || "platform",
				username: (payload.metadata?.username as string) || "unknown",
				email: payload.metadata?.email as string | undefined,
				avatar: payload.metadata?.avatar as string | undefined,
				permissions: payload.permissions,
				orgId: payload.metadata?.orgId as string | undefined,
			},
			createdAt: (payload.iat || 0) * 1000,
			expiresAt: (payload.exp || 0) * 1000,
		};
	}
}
