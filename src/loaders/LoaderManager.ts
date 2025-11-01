import { IModuleLoader } from './IModuleLoader.js';
import TypeScriptLoader from './typescript/index.js';
import PythonLoader from './python/index.js';
import { Logger } from '../utils/Logger.js';

export class LoaderManager {
  private static loaders: Map<string, IModuleLoader> = new Map([
    ['typescript', new TypeScriptLoader()],
    ['ts', new TypeScriptLoader()],
    ['python', new PythonLoader()],
    ['py', new PythonLoader()],
  ]);

  /**
   * Obtiene el loader para un lenguaje específico
   */
  static getLoader(language: string): IModuleLoader {
    const normalized = language.toLowerCase();
    const loader = this.loaders.get(normalized);

    if (!loader) {
      Logger.warn(`[LoaderManager] No hay loader para el lenguaje: ${language}`);
      // Retorna TypeScript por defecto
      return new TypeScriptLoader();
    }

    return loader;
  }

  /**
   * Registra un nuevo loader para un lenguaje
   */
  static registerLoader(language: string, loader: IModuleLoader): void {
    this.loaders.set(language.toLowerCase(), loader);
    Logger.info(`[LoaderManager] Loader registrado para: ${language}`);
  }

  /**
   * Obtiene todos los lenguajes soportados
   */
  static getSupportedLanguages(): string[] {
    return Array.from(this.loaders.keys());
  }
}
