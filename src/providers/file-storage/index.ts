import { IStorage, STORAGE_PROVIDER } from "../../interfaces/providers/IStorage.js";
import { IProvider } from "../../interfaces/IProvider.js";
import { Logger } from "../../utils/Logger.js";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Buffer } from "node:buffer";

// 1. La implementación concreta
class FileStorage implements IStorage {
	private readonly basePath: string;

	constructor(basePath: string) {
		this.basePath = basePath;
	}

	public async init() {
		// Asegurarse de que el directorio de almacenamiento exista
		fs.mkdir(this.basePath, { recursive: true }).catch((err) => Logger.error(`Error creando directorio: ${err}`));
	}

	private getKeyPath(key: string): string {
		// Usamos una extensión genérica. ¡Importante! Evitar 'path traversal'.
		const safeKey = path.basename(key);
		return path.join(this.basePath, `${safeKey}.bin`);
	}

	async save(key: string, data: Buffer): Promise<void> {
		const filePath = this.getKeyPath(key);
		Logger.debug(`[FileStorage] Guardando ${data.byteLength} bytes en ${filePath}...`);
		await fs.writeFile(filePath, data);
	}

	async load(key: string): Promise<Buffer | null> {
		const filePath = this.getKeyPath(key);
		try {
			const data = await fs.readFile(filePath);
			Logger.debug(`[FileStorage] Cargando ${data.byteLength} bytes desde ${filePath}...`);
			return data;
		} catch (err: any) {
			if (err.code === "ENOENT") {
				// ENOENT = Error NO ENTry (Archivo no encontrado)
				Logger.warn(`[FileStorage] Archivo no encontrado: ${key}`);
				return null;
			}
			// Otro error (ej. permisos)
			Logger.error(`[FileStorage] Error al cargar ${key}: ${err}`);
			throw err;
		}
	}
}

// 2. El Proveedor que la expone
export default class FileStorageProvider implements IProvider<IStorage> {
	public name = "file-storage-provider";
	public type = STORAGE_PROVIDER;

	private readonly fileStoragesMap = new Map<string, FileStorage>();

	getInstance(options?: any): IStorage {
		const basePath = options?.basePath || "./temp/file-storage";
		if (this.fileStoragesMap.has(basePath)) {
			return this.fileStoragesMap.get(basePath)!;
		} else {
			const newFileStorage = new FileStorage(basePath);
			newFileStorage.init().catch((err) => Logger.error(`Error inicializando FileStorage: ${err}`));
			this.fileStoragesMap.set(basePath, newFileStorage);
			return newFileStorage;
		}
	}

	async shutdown(): Promise<void> {
		Logger.ok("[FileStorageProvider] Detenido.");
	}
}
