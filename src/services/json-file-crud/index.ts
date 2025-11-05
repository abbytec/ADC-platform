import * as path from "node:path";
import { BaseService } from "../BaseService.js";
import { ILogger } from "../../interfaces/utils/ILogger.js";
import { IProvider } from "../../interfaces/modules/IProvider.js";
import { IStorage } from "../../interfaces/modules/providers/IStorage.js";
import { IMiddleware } from "../../interfaces/modules/IMiddleware.js";
import { IFileAdapter } from "../../interfaces/modules/middlewares/adapters/IFIleAdapter.js";

/**
 * Interfaz que define las operaciones CRUD para archivos JSON
 */
export interface IJsonFileCrud {
	create<T>(key: string, data: T): Promise<void>;
	read<T>(key: string): Promise<T | null>;
	update<T>(key: string, data: T): Promise<void>;
	delete(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	list(): Promise<string[]>;
}

/**
 * Implementación del CRUD para JSON en archivos usando providers y middlewares
 */
class JsonFileCrudImpl implements IJsonFileCrud {
	constructor(private readonly storage: IStorage, private readonly fileAdapter: IFileAdapter<any>, private readonly logger: ILogger) {}

	#getFilePath(key: string): string {
		const safeKey = path.basename(key);
		return safeKey;
	}

	async create<T>(key: string, data: T): Promise<void> {
		const filePath = this.#getFilePath(key);

		// Verificar si ya existe
		const exists = await this.storage.load(filePath);
		if (exists) {
			throw new Error(`[JsonFileCrud] El archivo '${key}' ya existe. Usa update() para modificarlo.`);
		}

		// Guardar usando el storage y el adaptador
		const buffer = this.fileAdapter.toBuffer(data);
		await this.storage.save(filePath, buffer);
		this.logger.logOk(`[JsonFileCrud] Archivo creado: ${key}`);
	}

	async read<T>(key: string): Promise<T | null> {
		const filePath = this.#getFilePath(key);

		try {
			const buffer = await this.storage.load(filePath);
			if (!buffer) {
				this.logger.logWarn(`[JsonFileCrud] Archivo no encontrado: ${key}`);
				return null;
			}
			const data = this.fileAdapter.fromBuffer(buffer) as T;
			this.logger.logDebug(`[JsonFileCrud] Archivo leído: ${key}`);
			return data;
		} catch (err: any) {
			throw new Error(`[JsonFileCrud] Error al leer ${key}: ${err.message}`);
		}
	}

	async update<T>(key: string, data: T): Promise<void> {
		const filePath = this.#getFilePath(key);

		// Verificar que existe
		const exists = await this.storage.load(filePath);
		if (!exists) {
			throw new Error(`[JsonFileCrud] El archivo '${key}' no existe. Usa create() para crear uno nuevo.`);
		}

		// Actualizar archivo
		const buffer = this.fileAdapter.toBuffer(data);
		await this.storage.save(filePath, buffer);
		this.logger.logDebug(`[JsonFileCrud] Archivo actualizado: ${key}`);
	}

	async delete(key: string): Promise<void> {
		// Nota: La implementación actual de FileStorage no tiene método delete
		// Por lo tanto, esta operación es un no-op o debería extenderse IStorage
		this.logger.logWarn(`[JsonFileCrud] Delete no soportado aún por el provider file-storage`);
	}

	async exists(key: string): Promise<boolean> {
		try {
			const filePath = this.#getFilePath(key);
			const buffer = await this.storage.load(filePath);
			return buffer !== null;
		} catch {
			return false;
		}
	}

	async list(): Promise<string[]> {
		// Nota: FileStorage no proporciona operación de listado
		// Esta funcionalidad requeriría extender IStorage
		this.logger.logWarn(`[JsonFileCrud] List no soportado aún por el provider file-storage`);
		return [];
	}
}

/**
 * Service que expone las operaciones CRUD para JSON usando módulos desacoplados
 * Extiende BaseService para heredar la lógica de carga de módulos
 */
export default class JsonFileCrudService extends BaseService<IJsonFileCrud> {
	public readonly name = "json-file-crud";

	private instance!: JsonFileCrudImpl;

	async getInstance(): Promise<IJsonFileCrud> {
		if (!this.instance) {
			// 1. Obtener la configuración para el provider de storage
			const storageProviderConfig = this.config?.providers?.find(
				(p) => p.name === "file-storage" || p.type === "storage-provider"
			)?.config;

			// 2. Obtener el provider del kernel
			const storageProvider = this.getProvider<IProvider<IStorage>>("storage-provider", storageProviderConfig);

			// 3. Obtener la instancia específica del storage (con el basePath correcto)
			const storage = await storageProvider.getInstance(storageProviderConfig);

			// 4. Repetir para el middleware adaptador de archivos
			const fileAdapterConfig = this.config?.middlewares?.find(
				(m) => m.name === "json-file-adapter" || m.type === "json-file-adapter"
			)?.config;
			const fileAdapterProvider = this.getMiddleware<IMiddleware<IFileAdapter<any>>>("json-file-adapter", fileAdapterConfig);
			const fileAdapter = await fileAdapterProvider.getInstance(fileAdapterConfig);

			// 5. Crear la instancia del CRUD
			this.instance = new JsonFileCrudImpl(storage, fileAdapter, this.logger);
		}
		return this.instance;
	}
}
