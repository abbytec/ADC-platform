import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IApp } from "../interfaces/IApp.js";
import { IKernel } from "../interfaces/IKernel.js";
import { IModulesDefinition } from "../interfaces/IModule.js";
import { ModuleLoader } from "../loaders/ModuleLoader.js";
import { Logger } from "../utils/Logger.js";


/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la carga de módulos desde modules.json.
 */
export abstract class BaseApp implements IApp {
  /** El nombre único de la app */
  abstract readonly name: string;

  protected kernel!: IKernel;
  protected moduleLoader = new ModuleLoader();

  constructor(kernel: IKernel){
    this.kernel = kernel;
  }

  /**
   * Lógica de inicialización.
   */
  public async start() { /* noop */ };

  /**
   * La lógica de negocio de la app.
   */
  abstract run(): Promise<void>;

  /**
   * Lógica de detención.
   */
  public async stop() { /* noop */ };

  /**
   * Carga módulos desde modules.json en el mismo directorio de la app
   */
  public async loadModulesFromConfig(): Promise<void> {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const appDir = isDevelopment
        ? path.resolve(process.cwd(), 'src', 'apps', this.name)
        : path.resolve(process.cwd(), 'dist', 'apps', this.name);

      const modulesConfigPath = path.join(appDir, 'modules.json');
      await this.moduleLoader.loadAllModulesFromConfig(modulesConfigPath, this.kernel);
    } catch (error) {
      Logger.error(`Error procesando modules.json: ${error}`);
      throw error;
    }
  }
}
