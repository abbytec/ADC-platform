import * as jose from "jose";
import { BaseProvider } from "../../BaseProvider.js";

/**
 * Payload del JWT de sesión
 */
export interface SessionPayload extends jose.JWTPayload {
	/** ID del usuario en la DB */
	userId: string;
	/** Permisos en formato [resource].[scope].action */
	permissions: string[];
	/** Metadatos adicionales (org, etc) */
	metadata?: Record<string, unknown>;
}

/**
 * Opciones de configuración del JWT
 */
export interface JWTProviderConfig {
	/** Secreto para firmar JWTs (mínimo 32 caracteres) */
	secret: string;
	/** Algoritmo de encriptación (default: A256GCM) */
	encryptionAlgorithm?: string;
	/** Algoritmo de key encryption (default: dir) */
	keyEncryptionAlgorithm?: string;
	/** Tiempo de expiración (default: 7d) */
	expiresIn?: string;
	/** Issuer del token */
	issuer?: string;
	/** Audience del token */
	audience?: string;
}

/**
 * Resultado de verificación de token
 */
export interface TokenVerificationResult {
	valid: boolean;
	payload?: SessionPayload;
	error?: string;
}

/**
 * Interface del JWT Provider
 */
export interface IJWTProvider {
	/**
	 * Crea un JWT cifrado con el payload proporcionado
	 */
	encrypt(payload: SessionPayload): Promise<string>;

	/**
	 * Descifra y verifica un JWT
	 */
	decrypt(token: string): Promise<TokenVerificationResult>;

	/**
	 * Verifica si un token es válido sin descifrar el payload completo
	 */
	verify(token: string): Promise<boolean>;
}

/**
 * JWTProvider - Cifrado y descifrado de tokens JWT usando jose
 *
 * Implementa JWE (JSON Web Encryption) para tokens seguros.
 * Los tokens son firmados y cifrados para máxima seguridad.
 */
export default class JWTProvider extends BaseProvider implements IJWTProvider {
	public readonly name = "jwt";
	public readonly type = "security-token";

	#secretKey: Uint8Array | null = null;
	#config: JWTProviderConfig;

	constructor(options?: any) {
		super();
		this.#config = {
			secret: options?.jwtSecret || process.env.JWT_SECRET || "",
			encryptionAlgorithm: "A256GCM",
			keyEncryptionAlgorithm: "dir",
			expiresIn: "7d",
			issuer: "adc-platform",
			audience: "adc-platform",
		};
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		const secret = this.#config.secret;
		if (!secret || secret.length < 32) {
			throw new Error("JWT_SECRET debe estar configurado con al menos 32 caracteres");
		}

		// Crear clave de 256 bits para A256GCM
		this.#secretKey = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
		this.logger.logOk("JWTProvider iniciado");
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		this.#secretKey = null;
	}

	/**
	 * Crea un JWT cifrado (JWE) con el payload proporcionado
	 */
	async encrypt(payload: SessionPayload): Promise<string> {
		if (!this.#secretKey) {
			throw new Error("JWTProvider no está inicializado");
		}

		const now = Math.floor(Date.now() / 1000);
		const expiresIn = this.#parseExpiration(this.#config.expiresIn || "7d");

		// Crear JWT cifrado (JWE) - los claims estándar se establecen via setters
		const token = await new jose.EncryptJWT(payload as jose.JWTPayload)
			.setProtectedHeader({
				alg: this.#config.keyEncryptionAlgorithm as "dir",
				enc: this.#config.encryptionAlgorithm as "A256GCM",
			})
			.setIssuedAt(now)
			.setExpirationTime(now + expiresIn)
			.setIssuer(this.#config.issuer!)
			.setAudience(this.#config.audience!)
			.encrypt(this.#secretKey);

		return token;
	}

	/**
	 * Descifra y verifica un JWT
	 */
	async decrypt(token: string): Promise<TokenVerificationResult> {
		if (!this.#secretKey) {
			return { valid: false, error: "JWTProvider no está inicializado" };
		}

		try {
			const { payload } = await jose.jwtDecrypt(token, this.#secretKey, {
				issuer: this.#config.issuer,
				audience: this.#config.audience,
			});

			return {
				valid: true,
				payload: payload as unknown as SessionPayload,
			};
		} catch (error: any) {
			const errorMessage = error instanceof jose.errors.JWTExpired ? "Token expirado" : error.message || "Token inválido";

			return {
				valid: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Verifica si un token es válido
	 */
	async verify(token: string): Promise<boolean> {
		const result = await this.decrypt(token);
		return result.valid;
	}

	/**
	 * Parsea string de expiración a segundos
	 */
	#parseExpiration(exp: string): number {
		const match = exp.match(/^(\d+)([smhdw])$/);
		if (!match) return 7 * 24 * 60 * 60; // default 7 días

		const value = parseInt(match[1], 10);
		const unit = match[2];

		const multipliers: Record<string, number> = {
			s: 1,
			m: 60,
			h: 60 * 60,
			d: 24 * 60 * 60,
			w: 7 * 24 * 60 * 60,
		};

		return value * (multipliers[unit] || 1);
	}
}
