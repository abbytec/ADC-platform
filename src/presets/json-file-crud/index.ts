import * as path from 'node:path';
import { BasePreset } from '../BasePreset.js';
import { Logger } from '../../utils/Logger.js';

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
  constructor(
    private readonly storage: any,
    private readonly fileAdapter: any
  ) {}

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
    Logger.ok(`[JsonFileCrud] Archivo creado: ${key}`);
  }

  async read<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    
    try {
      const buffer = await this.storage.load(filePath);
      if (!buffer) {
        Logger.warn(`[JsonFileCrud] Archivo no encontrado: ${key}`);
        return null;
      }
      const data = this.fileAdapter.fromBuffer(buffer) as T;
      Logger.info(`[JsonFileCrud] Archivo leído: ${key}`);
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
    Logger.ok(`[JsonFileCrud] Archivo actualizado: ${key}`);
  }

  async delete(key: string): Promise<void> {
    // Nota: La implementación actual de FileStorage no tiene método delete
    // Por lo tanto, esta operación es un no-op o debería extenderse IStorage
    Logger.warn(`[JsonFileCrud] Delete no soportado aún por el provider file-storage`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      const buffer = await this.storage.load(filePath);
      return buffer !== null;
    } catch (err) {
      return false;
    }
  }

  async list(): Promise<string[]> {
    // Nota: FileStorage no proporciona operación de listado
    // Esta funcionalidad requeriría extender IStorage
    Logger.warn(`[JsonFileCrud] List no soportado aún por el provider file-storage`);
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

  /**
   * Hook llamado después de cargar módulos
   * Aquí inicializamos la instancia del CRUD
   */
  protected async onInitialize(): Promise<void> {
    // Obtener las instancias del kernel
    const storage = this.getProvider("storage-provider");
    const fileAdapter = this.getMiddleware("json-file-adapter");

    // Crear instancia del CRUD
    this.instance = new JsonFileCrudImpl(storage, fileAdapter);
  }

  getInstance(): IJsonFileCrud {
    if (!this.instance) {
      throw new Error('[JsonFileCrud] Preset no ha sido inicializado. Llama a initialize() primero.');
    }
    return this.instance;
  }
}
