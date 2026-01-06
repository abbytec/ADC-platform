import { Redis } from "ioredis";
import { BaseProvider, ProviderType } from "../../BaseProvider.js";

/**
 * Configuración del RedisProvider
 */
export interface RedisProviderConfig {
	/** Host del servidor Redis (default: localhost) */
	host?: string;
	/** Puerto del servidor Redis (default: 6379) */
	port?: number;
	/** Password de Redis (opcional) */
	password?: string;
	/** Base de datos a usar (default: 0) */
	db?: number;
	/** Prefijo para las claves (default: "adc:") */
	keyPrefix?: string;
}

/**
 * Interface del Redis Provider
 */
export interface IRedisProvider {
	/** Cliente Redis para operaciones directas */
	readonly client: Redis;

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
 * RedisProvider - Cliente Redis para caché y colas
 *
 * Usa ioredis para conexión a Redis.
 * Soporta operaciones básicas, hashes, sets y TTL.
 */
export default class RedisProvider extends BaseProvider implements IRedisProvider {
	public readonly name = "redis";
	public readonly type = ProviderType.QUEUE_PROVIDER;

	#client: Redis | null = null;
	#config: RedisProviderConfig;

	constructor(config?: RedisProviderConfig) {
		super();
		this.#config = {
			host: config?.host || process.env.REDIS_HOST || "localhost",
			port: config?.port || parseInt(process.env.REDIS_PORT || "6379", 10),
			password: config?.password || process.env.REDIS_PASSWORD || undefined,
			db: config?.db || parseInt(process.env.REDIS_DB || "0", 10),
			keyPrefix: config?.keyPrefix || "adc:",
		};
	}

	get client(): Redis {
		if (!this.#client) {
			throw new Error("RedisProvider no está inicializado");
		}
		return this.#client;
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		this.#client = new Redis({
			host: this.#config.host,
			port: this.#config.port,
			password: this.#config.password,
			db: this.#config.db,
			keyPrefix: this.#config.keyPrefix,
			retryStrategy: (times) => {
				if (times > 3) {
					this.logger.logError("Redis: máximo de reintentos alcanzado");
					return null; // Stop retrying
				}
				return Math.min(times * 200, 2000);
			},
			maxRetriesPerRequest: 3,
		});

		// Manejar eventos
		this.#client.on("error", (err) => {
			this.logger.logError(`Redis error: ${err.message}`);
		});

		this.#client.on("connect", () => {
			this.logger.logDebug("Redis conectado");
		});

		// Verificar conexión
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
			await this.#client.quit();
			this.#client = null;
		}
	}

	// === Operaciones básicas ===

	async get(key: string): Promise<string | null> {
		return this.client.get(key);
	}

	async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
		if (ttlSeconds) {
			await this.client.setex(key, ttlSeconds, value);
		} else {
			await this.client.set(key, value);
		}
	}

	async del(key: string): Promise<void> {
		await this.client.del(key);
	}

	async exists(key: string): Promise<boolean> {
		const result = await this.client.exists(key);
		return result === 1;
	}

	// === Operaciones con TTL ===

	async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
		await this.client.setex(key, ttlSeconds, value);
	}

	async ttl(key: string): Promise<number> {
		return this.client.ttl(key);
	}

	async expire(key: string, ttlSeconds: number): Promise<boolean> {
		const result = await this.client.expire(key, ttlSeconds);
		return result === 1;
	}

	// === Operaciones con hash ===

	async hget(key: string, field: string): Promise<string | null> {
		return this.client.hget(key, field);
	}

	async hset(key: string, field: string, value: string): Promise<void> {
		await this.client.hset(key, field, value);
	}

	async hdel(key: string, field: string): Promise<void> {
		await this.client.hdel(key, field);
	}

	async hgetall(key: string): Promise<Record<string, string>> {
		return this.client.hgetall(key);
	}

	// === Operaciones con sets ===

	async sadd(key: string, ...members: string[]): Promise<number> {
		return this.client.sadd(key, ...members);
	}

	async srem(key: string, ...members: string[]): Promise<number> {
		return this.client.srem(key, ...members);
	}

	async smembers(key: string): Promise<string[]> {
		return this.client.smembers(key);
	}

	async sismember(key: string, member: string): Promise<boolean> {
		const result = await this.client.sismember(key, member);
		return result === 1;
	}

	// === Operaciones de incremento ===

	async incr(key: string): Promise<number> {
		return this.client.incr(key);
	}

	async incrby(key: string, increment: number): Promise<number> {
		return this.client.incrby(key, increment);
	}

	// === Operaciones de patrón ===

	async keys(pattern: string): Promise<string[]> {
		return this.client.keys(pattern);
	}

	async scan(cursor: number, pattern: string, count: number = 100): Promise<[string, string[]]> {
		return this.client.scan(cursor, "MATCH", pattern, "COUNT", count);
	}
}
