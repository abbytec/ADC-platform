import { IStorage } from "../../../interfaces/modules/providers/IStorage.js";
import { BaseProvider, ProviderType } from "../../BaseProvider.js";
import { ILogger } from "../../../interfaces/utils/ILogger.js";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Buffer } from "node:buffer";

// 1. La implementación concreta
class FileStorage implements IStorage {
	constructor(private readonly basePath: string, private readonly logger: ILogger) {}

	public async init() {
		// Asegurarse de que el directorio de almacenamiento exista
		fs.mkdir(this.basePath, { recursive: true }).catch((err) => this.logger.logError(`Error creating directory: ${err}`));
	}

	#getKeyPath(key: string): string {
		// Usamos una extensión genérica. ¡Importante! Evitar 'path traversal'.
		const safeKey = path.basename(key);
		return path.join(this.basePath, `${safeKey}.bin`);
	}

	async save(key: string, data: Buffer): Promise<void> {
		const filePath = this.#getKeyPath(key);
		this.logger.logDebug(`Saving ${data.byteLength} bytes to ${filePath}...`);
		await fs.writeFile(filePath, data);
	}

	async load(key: string): Promise<Buffer | null> {
		const filePath = this.#getKeyPath(key);
		try {
			const data = await fs.readFile(filePath);
			this.logger.logDebug(`Loading ${data.byteLength} bytes from ${filePath}...`);
			return data;
		} catch (err: any) {
			if (err.code === "ENOENT") {
				// ENOENT = Error NO ENTry (Archivo no encontrado)
				this.logger.logDebug(`File not found: ${key}`);
				return null;
			}
			// Otro error (ej. permisos)
			this.logger.logError(`Error loading ${key}: ${err}`);
			throw err;
		}
	}

	async delete(key: string): Promise<void> {
		const filePath = this.#getKeyPath(key);
		try {
			await fs.unlink(filePath);
			this.logger.logDebug(`Deleted file: ${key}`);
		} catch (err: any) {
			if (err.code === "ENOENT") {
				this.logger.logDebug(`File to delete not found: ${key}`);
				return; // No hacer nada si no existe
			}
			this.logger.logError(`Error deleting ${key}: ${err}`);
			throw err;
		}
	}

	async list(subPath?: string): Promise<string[]> {
		const dirPath = subPath ? path.join(this.basePath, subPath) : this.basePath;
		try {
			const files = await fs.readdir(dirPath);
			// Devolver solo los nombres de archivo sin la extensión .bin
			return files.map((file) => path.basename(file, ".bin"));
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return []; // Si el directorio no existe, no hay archivos
			}
			this.logger.logError(`Error listing files in ${dirPath}: ${err}`);
			throw err;
		}
	}
}

// 2. El Proveedor que la expone
export default class FileStorageProvider extends BaseProvider<IStorage> {
	public readonly name = "file-storage-provider";
	public readonly type = ProviderType.STORAGE_PROVIDER;

	readonly #fileStoragesMap = new Map<string, FileStorage>();

	async getInstance(options?: any): Promise<IStorage> {
		const basePath = options?.basePath || "./temp/file-storage";
		if (this.#fileStoragesMap.has(basePath)) {
			return this.#fileStoragesMap.get(basePath)!;
		} else {
			const newFileStorage = new FileStorage(basePath, this.logger);
			newFileStorage.init().catch((err) => this.logger.logError(`Error initializing FileStorage: ${err}`));
			this.#fileStoragesMap.set(basePath, newFileStorage);
			return newFileStorage;
		}
	}

	async shutdown(): Promise<void> {
		this.logger.logOk("Stopped.");
	}
}
