import { randomBytes } from "node:crypto";
import type { IRedisProvider } from "../../../../../providers/queue/redis/index.js";

/** Claves Redis para persistencia */
const REDIS_KEYS = {
	CURRENT: "session:keys:current",
	PREVIOUS: "session:keys:previous",
	ROTATED_AT: "session:keys:rotatedAt",
} as const;

/**
 * Configuración del KeyStore
 */
export interface KeyStoreConfig {
	/** Intervalo de rotación en ms (default: 24h) */
	rotationInterval: number;
	/** Longitud de las claves en bytes (default: 32) */
	keyLength: number;
	/** Claves iniciales (opcional, para fallback) */
	initialKeys?: {
		current: string;
		previous?: string;
	};
	/** Redis provider para persistencia (opcional) */
	redis?: IRedisProvider;
}

/**
 * Par de claves actual y anterior
 */
export interface KeyPair {
	current: Uint8Array;
	previous: Uint8Array | null;
	currentRaw: string;
	previousRaw: string | null;
	rotatedAt: number;
}

/**
 * Callback para notificar rotación de claves
 */
export type KeyRotationCallback = (keys: KeyPair) => void | Promise<void>;

/**
 * KeyStore - Gestión de secretos con rotación automática
 *
 * Soporta persistencia en Redis para compartir claves entre instancias.
 * Si Redis no está disponible, funciona con almacenamiento en memoria.
 */
export class KeyStore {
	#currentKey: string;
	#previousKey: string | null = null;
	#currentKeyBytes: Uint8Array;
	#previousKeyBytes: Uint8Array | null = null;
	#rotatedAt: number;
	#rotationInterval: number;
	#keyLength: number;
	#rotationTimer: ReturnType<typeof setInterval> | null = null;
	#rotationCallbacks: KeyRotationCallback[] = [];
	#redis: IRedisProvider | null = null;

	constructor(config: KeyStoreConfig) {
		this.#rotationInterval = config.rotationInterval;
		this.#keyLength = config.keyLength;
		this.#rotatedAt = Date.now();
		this.#redis = config.redis || null;

		// Inicializar con claves proporcionadas o generar nuevas
		if (config.initialKeys?.current) {
			this.#currentKey = config.initialKeys.current;
			this.#previousKey = config.initialKeys.previous || null;
		} else {
			this.#currentKey = this.#generateKey();
			this.#previousKey = null;
		}

		this.#currentKeyBytes = this.#stringToKey(this.#currentKey);
		this.#previousKeyBytes = this.#previousKey ? this.#stringToKey(this.#previousKey) : null;
	}

	/**
	 * Inicializa el KeyStore cargando claves desde Redis si está disponible
	 */
	async init(): Promise<void> {
		if (!this.#redis) return;

		try {
			const [current, previous, rotatedAt] = await Promise.all([
				this.#redis.get(REDIS_KEYS.CURRENT),
				this.#redis.get(REDIS_KEYS.PREVIOUS),
				this.#redis.get(REDIS_KEYS.ROTATED_AT),
			]);

			if (current) {
				this.#currentKey = current;
				this.#currentKeyBytes = this.#stringToKey(current);
				this.#previousKey = previous;
				this.#previousKeyBytes = previous ? this.#stringToKey(previous) : null;
				this.#rotatedAt = rotatedAt ? parseInt(rotatedAt, 10) : Date.now();
			} else {
				// No hay claves en Redis, persistir las actuales
				await this.#persistKeys();
			}
		} catch {
			// Si Redis falla, usar claves en memoria
		}
	}

	/**
	 * Inicia la rotación automática
	 */
	startRotation(): void {
		if (this.#rotationTimer) return;

		this.#rotationTimer = setInterval(() => {
			this.#rotate();
		}, this.#rotationInterval);
	}

	/**
	 * Detiene la rotación automática
	 */
	stopRotation(): void {
		if (this.#rotationTimer) {
			clearInterval(this.#rotationTimer);
			this.#rotationTimer = null;
		}
	}

	/**
	 * Ejecuta una rotación manual de claves
	 */
	async #rotate(): Promise<void> {
		this.#previousKey = this.#currentKey;
		this.#previousKeyBytes = this.#currentKeyBytes;
		this.#currentKey = this.#generateKey();
		this.#currentKeyBytes = this.#stringToKey(this.#currentKey);
		this.#rotatedAt = Date.now();

		// Persistir en Redis
		await this.#persistKeys();

		// Notificar a los listeners
		const keyPair = this.getKeyPair();
		for (const callback of this.#rotationCallbacks) {
			try {
				await callback(keyPair);
			} catch {
				// Los errores en callbacks no deben detener la rotación
			}
		}
	}

	/**
	 * Persiste las claves en Redis
	 */
	async #persistKeys(): Promise<void> {
		if (!this.#redis) return;

		try {
			await Promise.all([
				this.#redis.set(REDIS_KEYS.CURRENT, this.#currentKey),
				this.#previousKey ? this.#redis.set(REDIS_KEYS.PREVIOUS, this.#previousKey) : this.#redis.del(REDIS_KEYS.PREVIOUS),
				this.#redis.set(REDIS_KEYS.ROTATED_AT, this.#rotatedAt.toString()),
			]);
		} catch {
			// Silenciar errores de persistencia
		}
	}

	/**
	 * Registra un callback para cuando se rotan las claves
	 */
	onRotation(callback: KeyRotationCallback): void {
		this.#rotationCallbacks.push(callback);
	}

	/**
	 * Obtiene la clave actual como bytes
	 */
	getCurrentKeyBytes(): Uint8Array {
		return this.#currentKeyBytes;
	}

	/**
	 * Obtiene la clave anterior como bytes (si existe)
	 */
	getPreviousKeyBytes(): Uint8Array | null {
		return this.#previousKeyBytes;
	}

	/**
	 * Obtiene el par de claves completo
	 */
	getKeyPair(): KeyPair {
		return {
			current: this.#currentKeyBytes,
			previous: this.#previousKeyBytes,
			currentRaw: this.#currentKey,
			previousRaw: this.#previousKey,
			rotatedAt: this.#rotatedAt,
		};
	}

	/**
	 * Tiempo restante hasta la próxima rotación en ms
	 */
	getTimeUntilRotation(): number {
		const elapsed = Date.now() - this.#rotatedAt;
		return Math.max(0, this.#rotationInterval - elapsed);
	}

	/**
	 * Genera una clave aleatoria segura
	 */
	#generateKey(): string {
		return randomBytes(this.#keyLength).toString("base64");
	}

	/**
	 * Convierte string a Uint8Array de 32 bytes para A256GCM
	 */
	#stringToKey(key: string): Uint8Array {
		return new TextEncoder().encode(key.padEnd(32, "0").slice(0, 32));
	}
}
