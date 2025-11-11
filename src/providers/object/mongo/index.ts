import mongoose, { Connection, Model, Schema } from "mongoose";
import { BaseProvider, ProviderType } from "../../BaseProvider.js";
import { Logger } from "../../../utils/logger/Logger.js";

/**
 * Configuración del proveedor de MongoDB
 */
export interface IMongoConfig {
	uri: string;
	maxRetries?: number;
	retryDelay?: number;
	connectionTimeout?: number;
	serverSelectionTimeout?: number;
	socketTimeout?: number;
	autoReconnect?: boolean;
	reconnectInterval?: number;
}

/**
 * Interfaz del servicio de MongoDB
 */
export interface IMongoProvider {
	/**
	 * Obtiene la conexión actual de Mongoose
	 */
	getConnection(): Connection;

	/**
	 * Conecta a MongoDB
	 */
	connect(): Promise<void>;

	/**
	 * Desconecta de MongoDB
	 */
	disconnect(): Promise<void>;

	/**
	 * Verifica si está conectado
	 */
	isConnected(): boolean;

	/**
	 * Obtiene un modelo de Mongoose
	 */
	getModel<T>(name: string): Model<T>;

	/**
	 * Registra un esquema y retorna el modelo
	 */
	createModel<T>(name: string, schema: Schema): Model<T>;

	/**
	 * Obtiene estadísticas de la conexión
	 */
	getStats(): {
		connected: boolean;
		connectionString: string;
		retries: number;
		lastError?: string;
	};
}

/**
 * MongoProvider - Proveedor de conexión a MongoDB con tolerancia a fallos
 *
 * Características:
 * - Conexión automática con reintentos configurables
 * - Reconexión automática en caso de desconexión
 * - Manejo de errores y timeout
 * - Pool de conexiones
 * - Estadísticas de conexión
 */
export default class MongoProvider extends BaseProvider<IMongoProvider> {
	public readonly name = "mongo-provider";
	public readonly type = ProviderType.OBJECT_PROVIDER;

	private connection: Connection | null = null;
	private readonly config: IMongoConfig;
	private retryCount = 0;
	private lastError: string | undefined;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private initialized = false;
	private isDisconnecting = false;

	constructor(options?: any) {
		super();

		// Configuración con valores por defecto
		this.config = {
			uri: options?.uri || process.env.MONGODB_URI || "mongodb://localhost:27017/adc-platform",
			maxRetries: options?.maxRetries ?? 5,
			retryDelay: options?.retryDelay ?? 5000,
			connectionTimeout: options?.connectionTimeout ?? 10000,
			serverSelectionTimeout: options?.serverSelectionTimeout ?? 5000,
			socketTimeout: options?.socketTimeout ?? 45000,
			autoReconnect: options?.autoReconnect ?? true,
			reconnectInterval: options?.reconnectInterval ?? 10000,
		};

		// Configurar Mongoose
		this.#configureMongoose();
	}

	/**
	 * Configura opciones globales de Mongoose
	 */
	#configureMongoose(): void {
		mongoose.set("strict", true);
		mongoose.set("strictQuery", false);
	}

	async start(): Promise<void> {
		await this.connect();
	}

	/**
	 * Conecta a MongoDB con reintentos automáticos
	 */
	async connect(): Promise<void> {
		if (this.connection?.readyState === 1) {
			Logger.info(`[MongoProvider] Ya conectado a ${this.config.uri}`);
			return;
		}

		try {
			Logger.info(`[MongoProvider] Conectando a ${this.config.uri}...`);

			await mongoose.connect(this.config.uri, {
				connectTimeoutMS: this.config.connectionTimeout,
				serverSelectionTimeoutMS: this.config.serverSelectionTimeout,
				socketTimeoutMS: this.config.socketTimeout,
				retryWrites: true,
				retryReads: true,
				maxPoolSize: 10,
				minPoolSize: 5,
			});

			this.connection = mongoose.connection;
			this.retryCount = 0;
			this.lastError = undefined;

			// Configurar listeners para la reconexión automática
			this.#setupConnectionListeners();

			Logger.ok(`[MongoProvider] Conectado exitosamente a MongoDB`);
		} catch (error: any) {
			this.lastError = error.message;
			Logger.error(`[MongoProvider] Error conectando: ${error.message}`);
			await this.#handleConnectionError();
		}
	}

	/**
	 * Maneja errores de conexión con reintentos
	 */
	async #handleConnectionError(): Promise<void> {
		if (this.retryCount < this.config.maxRetries!) {
			this.retryCount++;
			const delay = this.config.retryDelay! * Math.pow(2, this.retryCount - 1); // Backoff exponencial
			Logger.warn(`[MongoProvider] Reintentando conexión (${this.retryCount}/${this.config.maxRetries}) en ${delay}ms...`);

			await new Promise((resolve) => setTimeout(resolve, delay));
			await this.connect();
		} else {
			Logger.error(`[MongoProvider] Se alcanzó el máximo de reintentos (${this.config.maxRetries}). No se pudo conectar a MongoDB.`);
			throw new Error(`No se pudo conectar a MongoDB después de ${this.config.maxRetries} intentos`);
		}
	}

	/**
	 * Configura listeners para eventos de conexión
	 */
	#setupConnectionListeners(): void {
		if (!this.connection) return;

		this.connection.on("connected", () => {
			Logger.ok(`[MongoProvider] Conexión establecida`);
			this.retryCount = 0;
		});

		this.connection.on("disconnected", () => {
			Logger.warn(`[MongoProvider] Desconectado de MongoDB`);

			if (this.config.autoReconnect && !this.isDisconnecting) {
				this.#scheduleReconnect();
			}
		});

		this.connection.on("error", (error: any) => {
			this.lastError = error.message;
			Logger.error(`[MongoProvider] Error de conexión: ${error.message}`);
		});

		this.connection.on("reconnected", () => {
			Logger.ok(`[MongoProvider] Reconectado a MongoDB`);
			this.retryCount = 0;
		});
	}

	/**
	 * Programa una reconexión automática
	 */
	#scheduleReconnect(): void {
		if (this.reconnectTimer) return;

		Logger.info(`[MongoProvider] Programando reconexión en ${this.config.reconnectInterval}ms...`);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect().catch((err) => {
				Logger.error(`[MongoProvider] Error en reconexión: ${err.message}`);
			});
		}, this.config.reconnectInterval);
	}

	async getInstance(): Promise<IMongoProvider> {
		const self = this;

		// Inicializar conexión la primera vez que se obtiene la instancia
		if (!self.initialized) {
			self.initialized = true;
			// Conectar sin bloquear (fire and forget)
			self.connect().catch((err: any) => {
				Logger.error(`[MongoProvider] Error durante conexión inicial: ${err.message}`);
			});
		}

		return {
			getConnection(): Connection {
				if (!self.connection) {
					throw new Error("MongoDB no está conectado");
				}
				return self.connection;
			},

			async connect(): Promise<void> {
				await self.connect();
			},

			async disconnect(): Promise<void> {
				await self.disconnect();
			},

			isConnected(): boolean {
				return self.connection?.readyState === 1;
			},

			getModel<T>(name: string): Model<T> {
				if (!self.connection) {
					throw new Error("MongoDB no está conectado");
				}
				return self.connection.model<T>(name);
			},

			createModel<T>(name: string, schema: Schema): Model<T> {
				if (!self.connection) {
					throw new Error("MongoDB no está conectado");
				}
				// Evitar crear modelos duplicados
				try {
					return self.connection.model<T>(name);
				} catch {
					return self.connection.model<T>(name, schema);
				}
			},

			getStats() {
				return {
					connected: self.connection?.readyState === 1,
					connectionString: self.config.uri,
					retries: self.retryCount,
					lastError: self.lastError,
				};
			},
		};
	}

	/**
	 * Desconecta de MongoDB
	 */
	async disconnect(): Promise<void> {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.connection) {
			try {
				await mongoose.disconnect();
				this.connection = null;
				Logger.ok(`[MongoProvider] Desconectado de MongoDB`);
			} catch (error: any) {
				Logger.error(`[MongoProvider] Error desconectando: ${error.message}`);
			}
		}
	}

	async stop(): Promise<void> {
		this.isDisconnecting = true;
		await this.disconnect();
	}
}
