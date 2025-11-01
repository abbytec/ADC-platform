import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IPreset } from '../../interfaces/IPreset.js';

export const JSON_FILE_CRUD_PRESET = Symbol.for('JSON_FILE_CRUD_PRESET');

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
 * Implementación del CRUD para JSON en archivos
 */
class JsonFileCrudImpl implements IJsonFileCrud {
  private readonly basePath: string;

  constructor(basePath: string = './temp/data') {
    this.basePath = basePath;
  }

  private getFilePath(key: string): string {
    // Sanitizar la clave para evitar path traversal
    const safeKey = path.basename(key);
    return path.join(this.basePath, `${safeKey}.json`);
  }

  async create<T>(key: string, data: T): Promise<void> {
    const filePath = this.getFilePath(key);
    
    // Verificar si ya existe
    try {
      await fs.stat(filePath);
      throw new Error(`[JsonFileCrud] El archivo '${key}' ya existe. Usa update() para modificarlo.`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Crear directorio si no existe
    await fs.mkdir(this.basePath, { recursive: true });

    // Guardar el archivo
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, 'utf-8');
    console.log(`[JsonFileCrud] Archivo creado: ${key}`);
  }

  async read<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as T;
      console.log(`[JsonFileCrud] Archivo leído: ${key}`);
      return data;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.warn(`[JsonFileCrud] Archivo no encontrado: ${key}`);
        return null;
      }
      throw new Error(`[JsonFileCrud] Error al leer ${key}: ${err.message}`);
    }
  }

  async update<T>(key: string, data: T): Promise<void> {
    const filePath = this.getFilePath(key);
    
    // Verificar que existe
    try {
      await fs.stat(filePath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new Error(`[JsonFileCrud] El archivo '${key}' no existe. Usa create() para crear uno nuevo.`);
      }
      throw err;
    }

    // Actualizar el archivo
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, 'utf-8');
    console.log(`[JsonFileCrud] Archivo actualizado: ${key}`);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    
    try {
      await fs.unlink(filePath);
      console.log(`[JsonFileCrud] Archivo eliminado: ${key}`);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new Error(`[JsonFileCrud] El archivo '${key}' no existe.`);
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    
    try {
      await fs.stat(filePath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.basePath);
      // Filtrar solo archivos .json y remover la extensión
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.slice(0, -5)); // Remover .json
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }
}

/**
 * Preset que expone las operaciones CRUD para JSON
 */
export default class JsonFileCrudPreset implements IPreset<IJsonFileCrud> {
  public name = JSON_FILE_CRUD_PRESET;
  
  private readonly basePath: string;
  private instance!: JsonFileCrudImpl;

  constructor(basePath: string = './data') {
    this.basePath = basePath;
  }

  async initialize(): Promise<void> {
    console.log(`[JsonFileCrud] Inicializando con basePath: ${this.basePath}`);
    await fs.mkdir(this.basePath, { recursive: true });
  }

  getInstance(): IJsonFileCrud {
    if (!this.instance) {
      this.instance = new JsonFileCrudImpl(this.basePath);
    }
    return this.instance;
  }

  async shutdown(): Promise<void> {
    console.log(`[JsonFileCrud] Detenido.`);
  }
}
