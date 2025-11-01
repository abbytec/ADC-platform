import * as path from 'node:path';
import { IModuleConfig } from '../interfaces/IModule.js';
import { IProvider } from '../interfaces/IProvider.js';
import { IMiddleware } from '../interfaces/IMIddleware.js';
import { IPreset } from '../interfaces/IPreset.js';
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
  async loadPreset(config: IModuleConfig): Promise<IPreset<any>> {
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

    // Cargar el módulo
    return await loader.loadPreset(resolved.path, config.config);
  }
}
