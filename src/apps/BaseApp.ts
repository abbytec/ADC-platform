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

      try {
        await fs.stat(modulesConfigPath);
      } catch {
        return;
      }

      const configContent = await fs.readFile(modulesConfigPath, 'utf-8');
      const modulesConfig: IModulesDefinition = JSON.parse(configContent);

      if (modulesConfig.providers && Array.isArray(modulesConfig.providers)) {
        for (const providerConfig of modulesConfig.providers) {
          try {
            const provider = await this.moduleLoader.loadProvider(providerConfig);
            const instance = await provider.getInstance();
            this.kernel.registerProvider(provider.name, instance, provider.type);
          } catch (error) {
            if (modulesConfig.failOnError) throw error;
            Logger.warn(`Error cargando provider ${providerConfig.name}: ${error}`);
          }
        }
      }

      if (modulesConfig.middlewares && Array.isArray(modulesConfig.middlewares)) {
        for (const middlewareConfig of modulesConfig.middlewares) {
          try {
            const middleware = await this.moduleLoader.loadMiddleware(middlewareConfig);
            const instance = await middleware.getInstance();
            this.kernel.registerMiddleware(middleware.name, instance);
          } catch (error) {
            if (modulesConfig.failOnError) throw error;
            Logger.warn(`Error cargando middleware ${middlewareConfig.name}: ${error}`);
          }
        }
      }

      if (modulesConfig.presets && Array.isArray(modulesConfig.presets)) {
        for (const presetConfig of modulesConfig.presets) {
          try {
            const preset = await this.moduleLoader.loadPreset(presetConfig);
            if (preset.initialize) {
              await preset.initialize();
            }
            const instance = preset.getInstance();
            this.kernel.registerPreset(preset.name, instance);
          } catch (error) {
            if (modulesConfig.failOnError) throw error;
            Logger.warn(`Error cargando preset ${presetConfig.name}: ${error}`);
          }
        }
      }
    } catch (error) {
      Logger.error(`Error procesando modules.json: ${error}`);
      throw error;
    }
  }
}
