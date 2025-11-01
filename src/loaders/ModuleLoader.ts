import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { IModuleConfig } from '../interfaces/IModule.js';
import { IModulesDefinition } from '../interfaces/IModule.js';
import { IProvider } from '../interfaces/IProvider.js';
import { IMiddleware } from '../interfaces/IMIddleware.js';
import { IPreset } from '../interfaces/IPreset.js';
import { IKernel } from '../interfaces/IKernel.js';
import { LoaderManager } from './LoaderManager.js';
import { VersionResolver } from '../utils/VersionResolver.js';
import { Logger } from '../utils/Logger.js';

export class ModuleLoader {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private readonly basePath = this.isDevelopment
    ? path.resolve(process.cwd(), 'src')
    : path.resolve(process.cwd(), 'dist');

  private readonly providersPath = path.resolve(this.basePath, 'providers');
  private readonly middlewaresPath = path.resolve(this.basePath, 'middlewares');
  private readonly presetsPath = path.resolve(this.basePath, 'presets');

  /**
   * Carga todos los módulos (providers, middlewares, presets) desde un modules.json
   */
  async loadAllModulesFromConfig(
    configPath: string,
    kernel: IKernel
  ): Promise<void> {
    try {
      try {
        await fs.stat(configPath);
      } catch {
        return; // El archivo no existe, no hay nada que cargar
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const modulesConfig: IModulesDefinition = JSON.parse(configContent);

      // Cargar providers
      if (modulesConfig.providers && Array.isArray(modulesConfig.providers)) {
        for (const providerConfig of modulesConfig.providers) {
          try {
            const provider = await this.loadProvider(providerConfig);
            const instance = await provider.getInstance();
            kernel.registerProvider(provider.name, instance, provider.type);
          } catch (error) {
            if (modulesConfig.failOnError) throw error;
            Logger.warn(`Error cargando provider ${providerConfig.name}: ${error}`);
          }
        }
      }

      // Cargar middlewares
      if (modulesConfig.middlewares && Array.isArray(modulesConfig.middlewares)) {
        for (const middlewareConfig of modulesConfig.middlewares) {
          try {
            const middleware = await this.loadMiddleware(middlewareConfig);
            const instance = await middleware.getInstance();
            kernel.registerMiddleware(middleware.name, instance);
          } catch (error) {
            if (modulesConfig.failOnError) throw error;
            Logger.warn(`Error cargando middleware ${middlewareConfig.name}: ${error}`);
          }
        }
      }

      // Cargar presets
      if (modulesConfig.presets && Array.isArray(modulesConfig.presets)) {
        for (const presetConfig of modulesConfig.presets) {
          try {
            const preset = await this.loadPreset(presetConfig, kernel);
            if (preset.initialize) {
              await preset.initialize();
            }
            const instance = preset.getInstance();
            kernel.registerPreset(preset.name, instance);
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

  /**
   * Carga un Provider usando modules.json
   */
  async loadProvider(config: IModuleConfig): Promise<IProvider<any>> {
    const language = config.language || 'typescript';
    const version = config.version || 'latest';

    Logger.debug(
      `[ModuleLoader] Cargando Provider: ${config.name} (v${version}, ${language})`
    );

    // Resolver la versión correcta
    const resolved = await VersionResolver.resolveModuleVersion(
      this.providersPath,
      config.name,
      version,
      language
    );

    if (!resolved) {
      throw new Error(
        `No se pudo resolver Provider: ${config.name}@${version} (${language})`
      );
    }

    // Obtener el loader correcto
    const loader = LoaderManager.getLoader(language);

    // Cargar el módulo
    return await loader.loadProvider(resolved.path, config.config);
  }

  /**
   * Carga un Middleware usando modules.json
   */
  async loadMiddleware(config: IModuleConfig): Promise<IMiddleware<any>> {
    const language = config.language || 'typescript';
    const version = config.version || 'latest';

    Logger.debug(
      `[ModuleLoader] Cargando Middleware: ${config.name} (v${version}, ${language})`
    );

    // Resolver la versión correcta
    const resolved = await VersionResolver.resolveModuleVersion(
      this.middlewaresPath,
      config.name,
      version,
      language
    );

    if (!resolved) {
      throw new Error(
        `No se pudo resolver Middleware: ${config.name}@${version} (${language})`
      );
    }

    // Obtener el loader correcto
    const loader = LoaderManager.getLoader(language);

    // Cargar el módulo
    return await loader.loadMiddleware(resolved.path, config.config);
  }

  /**
   * Carga un Preset usando modules.json
   */
  async loadPreset(config: IModuleConfig, kernel: IKernel): Promise<IPreset<any>> {
    const language = config.language || 'typescript';
    const version = config.version || 'latest';

    Logger.debug(
      `[ModuleLoader] Cargando Preset: ${config.name} (v${version}, ${language})`
    );

    // Resolver la versión correcta
    const resolved = await VersionResolver.resolveModuleVersion(
      this.presetsPath,
      config.name,
      version,
      language
    );

    if (!resolved) {
      throw new Error(
        `No se pudo resolver Preset: ${config.name}@${version} (${language})`
      );
    }

    // Obtener el loader correcto
    const loader = LoaderManager.getLoader(language);

    // Cargar el módulo pasando el kernel
    return await loader.loadPreset(resolved.path, kernel, config.config);
  }
}
