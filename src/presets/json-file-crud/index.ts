import * as path from "node:path";
import { BasePreset } from "../BasePreset.js";
import { ILogger } from "../../interfaces/utils/ILogger.js";

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
	constructor(private readonly storage: any, private readonly fileAdapter: any, private readonly logger: ILogger) {}

	private getFilePath(key: string): string {
		const safeKey = path.basename(key);
		return safeKey;
	}

	async create<T>(key: string, data: T): Promise<void> {
		const filePath = this.getFilePath(key);

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
		const filePath = this.getFilePath(key);

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
		const filePath = this.getFilePath(key);

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
			const filePath = this.getFilePath(key);
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
 * Preset que expone las operaciones CRUD para JSON usando módulos desacoplados
 * Extiende BasePreset para heredar la lógica de carga de módulos
 */
export default class JsonFileCrudPreset extends BasePreset<IJsonFileCrud> {
	public readonly name = "json-file-crud";

	private instance!: JsonFileCrudImpl;

	getInstance(): IJsonFileCrud {
		if (!this.instance) {
			const storage = this.getProvider("storage-provider");
			const fileAdapter = this.getMiddleware("json-file-adapter");
			this.instance = new JsonFileCrudImpl(storage, fileAdapter, this.logger);
		}
		return this.instance;
	}
}
