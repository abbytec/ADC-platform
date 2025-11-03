import { IStorage, STORAGE_PROVIDER } from "../../interfaces/providers/IStorage.js";
import { BaseProvider } from "../BaseProvider.js";
import { ILogger } from "../../interfaces/utils/ILogger.js";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Buffer } from "node:buffer";

// 1. La implementación concreta
class FileStorage implements IStorage {
	private readonly basePath: string;
	private readonly logger: ILogger;

	constructor(basePath: string, logger: ILogger) {
		this.basePath = basePath;
		this.logger = logger;
	}

	public async init() {
		// Asegurarse de que el directorio de almacenamiento exista
		fs.mkdir(this.basePath, { recursive: true }).catch((err) => this.logger.logError(`Error creating directory: ${err}`));
	}

	private getKeyPath(key: string): string {
		// Usamos una extensión genérica. ¡Importante! Evitar 'path traversal'.
		const safeKey = path.basename(key);
		return path.join(this.basePath, `${safeKey}.bin`);
	}

	async save(key: string, data: Buffer): Promise<void> {
		const filePath = this.getKeyPath(key);
		this.logger.logDebug(`Saving ${data.byteLength} bytes to ${filePath}...`);
		await fs.writeFile(filePath, data);
	}

	async load(key: string): Promise<Buffer | null> {
		const filePath = this.getKeyPath(key);
		try {
			const data = await fs.readFile(filePath);
			this.logger.logDebug(`Loading ${data.byteLength} bytes from ${filePath}...`);
			return data;
		} catch (err: any) {
			if (err.code === "ENOENT") {
				// ENOENT = Error NO ENTry (Archivo no encontrado)
				this.logger.logWarn(`File not found: ${key}`);
				return null;
			}
			// Otro error (ej. permisos)
			this.logger.logError(`Error loading ${key}: ${err}`);
			throw err;
		}
	}
}

// 2. El Proveedor que la expone
export default class FileStorageProvider extends BaseProvider<IStorage> {
	public name = "file-storage-provider";
	public type = STORAGE_PROVIDER;

	private readonly fileStoragesMap = new Map<string, FileStorage>();

	getInstance(options?: any): IStorage {
		const basePath = options?.basePath || "./temp/file-storage";
		if (this.fileStoragesMap.has(basePath)) {
			return this.fileStoragesMap.get(basePath)!;
		} else {
			const newFileStorage = new FileStorage(basePath, this.logger);
			newFileStorage.init().catch((err) => this.logger.logError(`Error initializing FileStorage: ${err}`));
			this.fileStoragesMap.set(basePath, newFileStorage);
			return newFileStorage;
		}
	}

	async shutdown(): Promise<void> {
		this.logger.logOk("Stopped.");
	}
}
