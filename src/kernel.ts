
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import chokidar from 'chokidar';
import { IKernel } from './interfaces/IKernel.js';
import { IApp } from './interfaces/IApp.js';
import { IMiddleware } from './interfaces/IMIddleware.js';
import { IProvider } from './interfaces/IProvider.js';
import { IPreset } from './interfaces/IPreset.js';
import { Logger } from './utils/Logger.js';

export class Kernel implements IKernel {
  // --- Registros por categoría ---
  private readonly providersRegistry = new Map<string, any>();
  private readonly middlewaresRegistry = new Map<string, any>();
  private readonly presetsRegistry = new Map<string, any>();
  private readonly appsRegistry = new Map<string, IApp>();
  
  private readonly providers = new Map<string, IProvider<any>>();
  private readonly middlewares = new Map<string, IMiddleware<any>>();
  private readonly presets = new Map<string, IPreset<any>>();
  private readonly apps = new Map<string, IApp>();

  // --- Determinación de entorno ---
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private readonly basePath = this.isDevelopment 
    ? path.resolve(process.cwd(), 'src')
    : path.resolve(process.cwd(), 'dist');
  private readonly fileExtension = this.isDevelopment ? '.ts' : '.js';

  // --- Rutas ---
  private readonly providersPath = path.resolve(this.basePath, 'providers');
  private readonly middlewaresPath = path.resolve(this.basePath, 'middlewares');
  private readonly presetsPath = path.resolve(this.basePath, 'presets');
  private readonly appsPath = path.resolve(this.basePath, 'apps');

  // --- API Pública del Kernel ---
  public registerProvider<T>(name: string, instance: T, type?: string): void {
    if (this.providersRegistry.has(name)) {
      Logger.warn(`ADVERTENCIA: Provider ${name} sobrescrito.`);
    }
    this.providersRegistry.set(name, instance);
    if (type && type !== name) {
      this.providersRegistry.set(type, instance);
    }
    Logger.ok(`Provider registrado: ${name}`);
  }

  public getProvider<T>(name: string): T {
    const instance = this.providersRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] Provider ${name} no encontrado.`);
    }
    return instance as T;
  }

  public registerMiddleware<T>(name: string, instance: T): void {
    if (this.middlewaresRegistry.has(name)) {
      Logger.warn(`ADVERTENCIA: Middleware ${name} sobrescrito.`);
    }
    this.middlewaresRegistry.set(name, instance);
    Logger.ok(`Middleware registrado: ${name}`);
  }

  public getMiddleware<T>(name: string): T {
    const instance = this.middlewaresRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] Middleware ${name} no encontrado.`);
    }
    return instance as T;
  }

  public registerPreset<T>(name: string, instance: T): void {
    if (this.presetsRegistry.has(name)) {
      Logger.warn(`ADVERTENCIA: Preset ${name} sobrescrito.`);
    }
    this.presetsRegistry.set(name, instance);
    Logger.ok(`Preset registrado: ${name}`);
  }

  public getPreset<T>(name: string): T {
    const instance = this.presetsRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] Preset ${name} no encontrado.`);
    }
    return instance as T;
  }

  public registerApp(name: string, instance: IApp): void {
    if (this.appsRegistry.has(name)) {
      Logger.warn(`ADVERTENCIA: App '${name}' sobrescrita.`);
    }
    this.appsRegistry.set(name, instance);
    Logger.ok(`App registrada: ${name}`);
  }

  public getApp(name: string): IApp {
    const instance = this.appsRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] App '${name}' no encontrada.`);
    }
    return instance;
  }

  // --- Lógica de Arranque ---
  public async start(): Promise<void> {
    Logger.info("Iniciando...");
    Logger.info(`Modo: ${this.isDevelopment ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    Logger.debug(`Base path: ${this.basePath}`);

    // Solo cargar Apps (que cargarán sus propios módulos desde modules.json)
    await this.loadLayerRecursive(this.appsPath, this.loadApp.bind(this), ['BaseApp.ts']);
    
    // Iniciar watchers para carga dinámica (solo en desarrollo)
    if (this.isDevelopment) {
      this.watchLayer(this.providersPath, this.loadProvider.bind(this), this.unloadProvider.bind(this));
      this.watchLayer(this.middlewaresPath, this.loadMiddleware.bind(this), this.unloadMiddleware.bind(this));
      this.watchLayer(this.presetsPath, this.loadPreset.bind(this), this.unloadPreset.bind(this));
      this.watchLayer(this.appsPath, this.loadApp.bind(this), this.unloadApp.bind(this), ['BaseApp.ts']);
    }

    Logger.ok("En funcionamiento.");
  }

  /**
   * Carga todos los providers de forma recursiva
   * Usado por apps que lo necesiten
   */
  public async loadAllProviders(): Promise<void> {
    await this.loadLayerRecursive(this.providersPath, this.loadProvider.bind(this));
  }

  /**
   * Carga todos los middlewares de forma recursiva
   * Usado por apps que lo necesiten
   */
  public async loadAllMiddlewares(): Promise<void> {
    await this.loadLayerRecursive(this.middlewaresPath, this.loadMiddleware.bind(this));
  }

  /**
   * Carga todos los presets de forma recursiva
   * Usado por apps que lo necesiten
   */
  public async loadAllPresets(): Promise<void> {
    await this.loadLayerRecursive(this.presetsPath, this.loadPreset.bind(this));
  }

  /**
   * Carga un módulo específico de un tipo (provider, middleware o preset)
   */
  public async loadModuleOfType(
    type: 'provider' | 'middleware' | 'preset',
    moduleName: string,
    version: string = 'latest',
    language: string = 'typescript'
  ): Promise<void> {
    const basePath = {
      'provider': this.providersPath,
      'middleware': this.middlewaresPath,
      'preset': this.presetsPath
    }[type];

    const loader = {
      'provider': this.loadProvider.bind(this),
      'middleware': this.loadMiddleware.bind(this),
      'preset': this.loadPreset.bind(this)
    }[type];

    try {
      // Buscar el módulo en el base path
      const moduleDir = path.join(basePath, moduleName);
      const indexFile = path.join(moduleDir, `index${this.fileExtension}`);
      
      try {
        await fs.stat(indexFile);
        await loader(indexFile);
      } catch {
        Logger.warn(`[Kernel] No se encontró ${type} '${moduleName}'`);
      }
    } catch (error) {
      Logger.error(`[Kernel] Error cargando ${type} '${moduleName}': ${error}`);
    }
  }

  // --- Lógica de Cierre ---
  public async stop(): Promise<void> {
    Logger.info("\nIniciando cierre ordenado...");
    
    // 1. Detener Apps
    Logger.info("Deteniendo apps...");
    for (const [, app] of this.apps) {
      try {
        Logger.debug(`Deteniendo app ${app.name}`);
        await app.stop?.();
      } catch (e) {
        Logger.error(`Error deteniendo app ${app.name}: ${e}`);
      }
    }
    
    // 2. Detener Presets
    Logger.info("Deteniendo presets...");
    for (const [, preset] of this.presets) {
      try {
        await preset.shutdown?.();
      } catch (e) {
        Logger.error(`Error deteniendo preset ${preset.name}: ${e}`);
      }
    }
    
    // 3. Detener Middlewares
    Logger.info("Deteniendo middlewares...");
    for (const [, middleware] of this.middlewares) {
      try {
        await middleware.shutdown?.();
      } catch (e) {
        Logger.error(`Error deteniendo middleware ${middleware.name}: ${e}`);
      }
    }
    
    // 4. Detener Providers
    Logger.info("Deteniendo providers...");
    for (const [, provider] of this.providers) {
      try {
        await provider.shutdown?.();
      } catch (e) {
        Logger.error(`Error deteniendo provider ${provider.name}: ${e}`);
      }
    }
    
    Logger.ok("Cierre completado.");
  }

  /**
   * Búsqueda recursiva ilimitada de todos los 'index.ts'/'index.js' en una capa.
   */
  private async loadLayerRecursive(
    dir: string, 
    loader: (entryPath: string) => Promise<void>,
    exclude: string[] = []
  ): Promise<void> {
    try {
      // Primero, buscar si el mismo directorio tiene index
      const indexPath = path.join(dir, `index${this.fileExtension}`);
      try {
        if ((await fs.stat(indexPath)).isFile()) {
          await loader(indexPath);
          return; // Si encontramos index aquí, no buscar más
        }
      } catch {
        // No hay index en este nivel, continuar
      }

      // Luego, buscar recursivamente en subdirectorios
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (exclude.includes(entry.name)) continue;

        if (entry.isDirectory()) {
          const subDirPath = path.join(dir, entry.name);
          await this.loadLayerRecursive(subDirPath, loader, exclude);
        }
      }
    } catch {
      // El directorio no existe o no se puede leer, ignorar
    }
  }

  private async loadProvider(filePath: string): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const ProviderClass = module.default;
      if (!ProviderClass) return;

      const provider: IProvider<any> = new ProviderClass();
      const instance = await provider.getInstance();
      
      this.registerProvider(provider.name, instance, provider.type);
      this.providers.set(filePath, provider);
      
    } catch (e) {
      Logger.error(`Error cargando Provider ${filePath}: ${e}`);
    }
  }

  private async loadMiddleware(filePath: string): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const MiddlewareClass = module.default;
      if (!MiddlewareClass) return;

      const middleware: IMiddleware<any> = new MiddlewareClass();
      const instance = await middleware.getInstance();
      
      this.registerMiddleware(middleware.name, instance);
      this.middlewares.set(filePath, middleware);
      
    } catch (e) {
      Logger.error(`Error cargando Middleware ${filePath}: ${e}`);
    }
  }

  private async loadPreset(filePath: string): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const PresetClass = module.default;
      if (!PresetClass) return;

      const preset: IPreset<any> = new PresetClass(this);
      if (preset.initialize) {
        await preset.initialize();
      }
      
      const instance = preset.getInstance();
      this.registerPreset(preset.name, instance);
      this.presets.set(filePath, preset);
      
    } catch (e) {
      Logger.error(`Error cargando Preset ${filePath}: ${e}`);
    }
  }

  private async loadApp(filePath: string): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const AppClass = module.default;
      if (!AppClass) return;
      
      const app: IApp = new AppClass(this);
      Logger.debug(`Inicializando App ${app.name}`);
      await app.loadModulesFromConfig();
      await app.start?.();
      this.apps.set(filePath, app);
      Logger.debug(`Ejecutando App ${app.name}`)
      await app.run();
    } catch (e) {
      Logger.error(`Error ejecutando App ${filePath}: ${e}`);
    }
  }
  
  // --- Lógica de Watchers y Descarga ---
  private watchLayer(
    dir: string, 
    loader: (p: string) => Promise<void>, 
    unloader: (p: string) => Promise<void>,
    exclude: string[] = []
  ) {
    const watcher = chokidar.watch(path.join(dir, `**/index${this.fileExtension}`), { 
      ignoreInitial: true,
      ignored: exclude
    });
    watcher.on('add', p => loader(p));
    watcher.on('change', async p => {
      await unloader(p);
      await loader(p);
    });
    watcher.on('unlink', p => unloader(p));
  }
  
  private async unloadProvider(filePath: string) {
    const provider = this.providers.get(filePath);
    if(provider) {
      Logger.debug(`Removiendo provider: ${provider.name}`);
      await provider.shutdown?.();
      this.providersRegistry.delete(provider.name);
      if (provider.type && provider.type !== provider.name) {
        this.providersRegistry.delete(provider.type);
      }
      this.providers.delete(filePath);
    }
  }
  
  private async unloadMiddleware(filePath: string) {
    const mw = this.middlewares.get(filePath);
    if(mw) {
      Logger.debug(`Removiendo middleware: ${mw.name}`);
      await mw.shutdown?.();
      this.middlewaresRegistry.delete(mw.name);
      this.middlewares.delete(filePath);
    }
  }

  private async unloadPreset(filePath: string) {
    const preset = this.presets.get(filePath);
    if(preset) {
      Logger.debug(`Removiendo preset: ${preset.name}`);
      await preset.shutdown?.();
      this.presetsRegistry.delete(preset.name);
      this.presets.delete(filePath);
    }
  }
  
  private async unloadApp(filePath: string) {
    const app = this.apps.get(filePath);
    if(app) {
      Logger.debug(`Removiendo app: ${app.name}`);
      await app.stop?.();
      this.appsRegistry.delete(app.name);
      this.apps.delete(filePath);
    }
  }
}
