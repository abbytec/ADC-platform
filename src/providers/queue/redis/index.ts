import { RedisClient } from "bun";
import { BaseProvider, ProviderType } from "../../BaseProvider.js";

/**
 * Configuración del RedisProvider
 */
export interface RedisProviderConfig {
	host?: string;
	port?: number;
	password?: string;
	db?: number;
	keyPrefix?: string;
}

/**
 * Interface del Redis Provider
 */
export interface IRedisProvider {
	/** Cliente Redis nativo de Bun */
	readonly client: RedisClient;
	// Operaciones básicas
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds?: number): Promise<void>;
	del(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	// Operaciones con TTL
	setex(key: string, ttlSeconds: number, value: string): Promise<void>;
	ttl(key: string): Promise<number>;
	expire(key: string, ttlSeconds: number): Promise<boolean>;
	// Operaciones con hash
	hget(key: string, field: string): Promise<string | null>;
	hset(key: string, field: string, value: string): Promise<void>;
	hdel(key: string, field: string): Promise<void>;
	hgetall(key: string): Promise<Record<string, string>>;
	// Operaciones con sets
	sadd(key: string, ...members: string[]): Promise<number>;
	srem(key: string, ...members: string[]): Promise<number>;
	smembers(key: string): Promise<string[]>;
	sismember(key: string, member: string): Promise<boolean>;
	// Operaciones de incremento
	incr(key: string): Promise<number>;
	incrby(key: string, increment: number): Promise<number>;
	// Operaciones de patrón
	keys(pattern: string): Promise<string[]>;
	scan(cursor: number, pattern: string, count?: number): Promise<[string, string[]]>;
}

/**
 * RedisProvider - Cliente Redis nativo para Bun
 * * Usa el cliente nativo de Bun (bun:redis).
 */
export default class RedisProvider extends BaseProvider implements IRedisProvider {
	public readonly name = "redis";
	public readonly type = ProviderType.QUEUE_PROVIDER;

	#client: RedisClient | null = null;
	#config: RedisProviderConfig;

	constructor(config?: RedisProviderConfig) {
		super();
		// Usamos Bun.env para acceso nativo y rápido a variables de entorno
		this.#config = {
			host: config?.host || Bun.env.REDIS_HOST || "localhost",
			port: config?.port || Number.parseInt(Bun.env.REDIS_PORT || "6380", 10),
			password: config?.password || Bun.env.REDIS_PASSWORD || undefined,
			db: config?.db || Number.parseInt(Bun.env.REDIS_DB || "0", 10),
			keyPrefix: config?.keyPrefix || "adc:",
		};
	}

	get client(): RedisClient {
		if (!this.#client) {
			throw new Error("RedisProvider no está inicializado");
		}
		return this.#client;
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		// Construcción de la URL de conexión para Bun RedisClient
		const { host, port, password, db } = this.#config;
		let url = `redis://${host}:${port}`;
		if (password) {
			url = `redis://:${password}@${host}:${port}`;
		}
		if (db) {
			url += `/${db}`;
		}

		// Inicialización del cliente nativo
		this.#client = new RedisClient(url, {
			// Opciones adicionales si fueran necesarias
		});

		// Manejo de eventos (Bun RedisClient soporta una API similar a EventEmitter)
		this.#client.onclose = (msg) => {
			this.logger.logDebug(`${msg.message}`);
		};

		this.#client.onconnect = () => {
			this.logger.logDebug("Redis conectado");
		};

		try {
			await this.#client.ping();
			this.logger.logOk(`RedisProvider iniciado (${this.#config.host}:${this.#config.port})`);
		} catch (err: any) {
			this.logger.logError(`Error conectando a Redis: ${err.message}`);
			throw err;
		}
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		if (this.#client) {
			// El cliente nativo usa quit() o close()
			this.#client.close();
			this.#client = null;
		}
	}

	// === Operaciones básicas ===
	async get(key: string): Promise<string | null> {
		return this.client.get(key);
	}

	async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
		const finalKey = this._k(key);
		if (ttlSeconds) {
			// Bun soporta argumentos estándar de Redis
			await this.client.set(finalKey, value, "EX", ttlSeconds);
		} else {
			await this.client.set(finalKey, value);
		}
	}

	async del(key: string): Promise<void> {
		await this.client.del(this._k(key));
	}

	async exists(key: string): Promise<boolean> {
		const result = await this.client.exists(this._k(key));
		return result;
	}

	// === Operaciones con TTL ===
	async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
		await this.client.setex(this._k(key), ttlSeconds, value);
	}

	async ttl(key: string): Promise<number> {
		return this.client.ttl(this._k(key));
	}

	async expire(key: string, ttlSeconds: number): Promise<boolean> {
		const result = await this.client.expire(this._k(key), ttlSeconds);
		return result === 1;
	}

	// === Operaciones con hash ===
	async hget(key: string, field: string): Promise<string | null> {
		return this.client.hget(this._k(key), field);
	}

	async hset(key: string, field: string, value: string): Promise<void> {
		// hset devuelve el número de campos añadidos, pero la interfaz pide void
		await this.client.hset(this._k(key), field, value);
	}

	async hdel(key: string, field: string): Promise<void> {
		await this.client.hdel(this._k(key), field);
	}

	async hgetall(key: string): Promise<Record<string, string>> {
		return this.client.hgetall(this._k(key));
	}

	// === Operaciones con sets ===
	async sadd(key: string, ...members: string[]): Promise<number> {
		return this.client.sadd(this._k(key), ...members);
	}

	async srem(key: string, ...members: string[]): Promise<number> {
		return this.client.srem(this._k(key), ...members);
	}

	async smembers(key: string): Promise<string[]> {
		return this.client.smembers(this._k(key));
	}

	async sismember(key: string, member: string): Promise<boolean> {
		return await this.client.sismember(this._k(key), member);
	}

	// === Operaciones de incremento ===
	async incr(key: string): Promise<number> {
		return this.client.incr(this._k(key));
	}

	async incrby(key: string, increment: number): Promise<number> {
		return this.client.incrby(this._k(key), increment);
	}

	// === Operaciones de patrón ===
	async keys(pattern: string): Promise<string[]> {
		// Nota: keys usa el prefijo si se lo aplicamos
		return this.client.keys(this._k(pattern));
	}

	async scan(cursor: number, pattern: string, count: number = 100): Promise<[string, string[]]> {
		return await this.client.scan(cursor.toString(), "MATCH", this._k(pattern), "COUNT", count);
	}

	/**
	 * Helper privado para aplicar el prefijo manualmente,
	 * ya que el cliente nativo de Bun podría no soportarlo transparentemente en config todavía.
	 */
	private _k(key: string): string {
		if (!this.#config.keyPrefix) return key;
		return `${this.#config.keyPrefix}${key}`;
	}
}
