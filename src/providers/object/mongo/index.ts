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
 * Estadísticas de múltiples conexiones
 */
export interface MultiDbStats {
	connections: Array<{
		uri: string;
		databases: string[];
		connected: boolean;
		poolSize: number;
	}>;
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

	// ─────────────────────────────────────────────────────────────────────────────
	// Multi-DB Support
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Obtiene o crea una conexión a una URI específica
	 * Reutiliza conexiones existentes a la misma URI
	 */
	getOrCreateConnection(uri: string): Promise<Connection>;

	/**
	 * Cambia a una base de datos diferente en una conexión existente
	 * Usa mongoose useDb() para conexiones virtuales
	 */
	useDb(connection: Connection, dbName: string): Connection;

	/**
	 * Crea un modelo para una conexión de base de datos específica
	 */
	createModelForDb<T>(dbConnection: Connection, name: string, schema: Schema): Model<T>;

	/**
	 * Cierra una conexión específica
	 */
	closeConnection(uri: string): Promise<void>;

	/**
	 * Obtiene estadísticas de múltiples conexiones
	 */
	getMultiDbStats(): MultiDbStats;
}

/**
 * MongoProvider - Proveedor de conexión a MongoDB con tolerancia a fallos
 *
 * Características:
 * - Conexión automática con reintentos configurables
 * - Reconexión automática en caso de desconexión
 * - Manejo de errores y timeout
 * - Pool de conexiones
 * - Soporte multi-database con connection.useDb()
 * - Reutilización de instancias por connectionUri
 */
export default class MongoProvider extends BaseProvider implements IMongoProvider {
	public readonly name = "mongo-provider";
	public readonly type = ProviderType.OBJECT_PROVIDER;

	private connection: Connection | null = null;
	private readonly config: IMongoConfig;
	private retryCount = 0;
	private lastError: string | undefined;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private initialized = false;
	private isDisconnecting = false;

	// Multi-DB support
	#connections: Map<string, Connection> = new Map();
	#dbConnections: Map<string, Connection> = new Map();

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

	/**
	 * Conecta a MongoDB con reintentos automáticos
	 */
	async connect(): Promise<void> {
		if (this.connection?.readyState === 1) {
			Logger.info(`[MongoProvider] Ya conectado a ${this.config.uri}`);
			return;
		}

		try {
			// Usar createConnection en lugar de connect para permitir múltiples conexiones
			this.connection = await mongoose
				.createConnection(this.config.uri, {
					connectTimeoutMS: this.config.connectionTimeout,
					serverSelectionTimeoutMS: this.config.serverSelectionTimeout,
					socketTimeoutMS: this.config.socketTimeout,
					retryWrites: true,
					retryReads: true,
					maxPoolSize: 10,
					minPoolSize: 5,
				})
				.asPromise();

			Logger.info(`[MongoProvider] Conectado a ${this.connection.db.databaseName}...`);

			// Registrar en el mapa de conexiones
			this.#connections.set(this.config.uri, this.connection);

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
			if (!this.isDisconnecting) Logger.warn(`[MongoProvider] Desconectado de MongoDB`);

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
			if (!this.isDisconnecting)
				this.connect().catch((err) => {
					Logger.error(`[MongoProvider] Error en reconexión: ${err.message}`);
				});
		}, this.config.reconnectInterval);
	}

	async start(kernelKey: symbol): Promise<void> {
		// Inicializar conexión al arrancar
		super.start(kernelKey);
		if (!this.initialized) {
			this.initialized = true;
			this.connect().catch((err: any) => {
				Logger.error(`[MongoProvider] Error durante conexión inicial: ${err.message}`);
			});
		}
	}

	getConnection(): Connection {
		if (!this.connection) throw new Error("MongoDB no está conectado");
		return this.connection;
	}

	isConnected(): boolean {
		return this.connection?.readyState === 1;
	}

	getModel<T>(name: string): Model<T> {
		if (!this.connection) throw new Error("MongoDB no está conectado");
		return this.connection.model<T>(name);
	}

	createModel<T>(name: string, schema: Schema): Model<T> {
		if (!this.connection) throw new Error("MongoDB no está conectado");
		try {
			return this.connection.model<T>(name);
		} catch {
			return this.connection.model<T>(name, schema);
		}
	}

	getStats(): { connected: boolean; connectionString: string; retries: number; lastError?: string } {
		return {
			connected: this.connection?.readyState === 1,
			connectionString: this.config.uri,
			retries: this.retryCount,
			lastError: this.lastError,
		};
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Multi-DB Support
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Obtiene o crea una conexión a una URI específica
	 * Reutiliza conexiones existentes a la misma URI
	 */
	async getOrCreateConnection(uri: string): Promise<Connection> {
		// Verificar si ya tenemos esta conexión
		const existing = this.#connections.get(uri);
		if (existing?.readyState === 1) {
			return existing;
		}

		// Crear nueva conexión
		const connection = await mongoose
			.createConnection(uri, {
				connectTimeoutMS: this.config.connectionTimeout,
				serverSelectionTimeoutMS: this.config.serverSelectionTimeout,
				socketTimeoutMS: this.config.socketTimeout,
				retryWrites: true,
				retryReads: true,
				maxPoolSize: 10,
				minPoolSize: 2,
			})
			.asPromise();

		this.#connections.set(uri, connection);
		Logger.ok(`[MongoProvider] Nueva conexión establecida: ${uri}`);

		return connection;
	}

	/**
	 * Cambia a una base de datos diferente en una conexión existente
	 * Retorna una conexión virtual a la base de datos especificada
	 */
	useDb(connection: Connection, dbName: string): Connection {
		const key = `${connection.host}:${connection.port}/${dbName}`;

		// Verificar cache
		const cached = this.#dbConnections.get(key);
		if (cached) {
			return cached;
		}

		// Crear conexión virtual usando useDb
		const dbConnection = connection.useDb(dbName, { useCache: true });
		this.#dbConnections.set(key, dbConnection);

		Logger.debug(`[MongoProvider] Conexión virtual a DB: ${dbName}`);
		return dbConnection;
	}

	/**
	 * Crea un modelo para una conexión de base de datos específica
	 */
	createModelForDb<T>(dbConnection: Connection, name: string, schema: Schema): Model<T> {
		try {
			return dbConnection.model<T>(name);
		} catch {
			return dbConnection.model<T>(name, schema);
		}
	}

	/**
	 * Cierra una conexión específica
	 */
	async closeConnection(uri: string): Promise<void> {
		const connection = this.#connections.get(uri);
		if (connection) {
			// Limpiar conexiones virtuales asociadas
			const hostPort = `${connection.host}:${connection.port}`;
			for (const [key] of this.#dbConnections) {
				if (key.startsWith(hostPort)) {
					this.#dbConnections.delete(key);
				}
			}

			await connection.close();
			this.#connections.delete(uri);
			Logger.ok(`[MongoProvider] Conexión cerrada: ${uri}`);
		}
	}

	/**
	 * Obtiene estadísticas de múltiples conexiones
	 */
	getMultiDbStats(): MultiDbStats {
		const connections: MultiDbStats["connections"] = [];

		for (const [uri, conn] of this.#connections) {
			const databases: string[] = [];
			const hostPort = `${conn.host}:${conn.port}`;

			for (const [key] of this.#dbConnections) {
				if (key.startsWith(hostPort)) {
					const dbName = key.split("/").pop();
					if (dbName) databases.push(dbName);
				}
			}

			connections.push({
				uri,
				databases,
				connected: conn.readyState === 1,
				poolSize: 10, // from config
			});
		}

		return { connections };
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
				await this.connection.close();
				this.connection = null;
				Logger.ok(`[MongoProvider] Desconectado de MongoDB`);
			} catch (error: any) {
				Logger.error(`[MongoProvider] Error desconectando: ${error.message}`);
			}
		}
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		this.isDisconnecting = true;

		// Cerrar todas las conexiones adicionales
		for (const [uri] of this.#connections) {
			if (uri !== this.config.uri) {
				await this.closeConnection(uri);
			}
		}

		// Limpiar caches
		this.#connections.clear();
		this.#dbConnections.clear();

		await this.disconnect();
	}
}
