
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import chokidar from 'chokidar';
import { IKernel } from './interfaces/IKernel.js';
import { IApp } from './interfaces/IApp.js';
import { IMiddleware } from './interfaces/IMIddleware.js';
import { IProvider } from './interfaces/IProvider.js';
import { IPreset } from './interfaces/IPreset.js';

export class Kernel implements IKernel {
  // --- Registros por categoría ---
  private readonly providersRegistry = new Map<symbol, any>();
  private readonly middlewaresRegistry = new Map<symbol, any>();
  private readonly presetsRegistry = new Map<symbol, any>();
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
  public registerProvider<T>(name: symbol, instance: T, type?: symbol): void {
    if (this.providersRegistry.has(name)) {
      console.warn(`[Kernel] ADVERTENCIA: Provider ${name.description} sobrescrito.`);
    }
    this.providersRegistry.set(name, instance);
    if (type && type !== name) {
      this.providersRegistry.set(type, instance);
    }
    console.log(`[Kernel] Provider registrado: ${name.description}`);
  }

  public getProvider<T>(name: symbol): T {
    const instance = this.providersRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] Provider ${name.description} no encontrado.`);
    }
    return instance as T;
  }

  public registerMiddleware<T>(name: symbol, instance: T): void {
    if (this.middlewaresRegistry.has(name)) {
      console.warn(`[Kernel] ADVERTENCIA: Middleware ${name.description} sobrescrito.`);
    }
    this.middlewaresRegistry.set(name, instance);
    console.log(`[Kernel] Middleware registrado: ${name.description}`);
  }

  public getMiddleware<T>(name: symbol): T {
    const instance = this.middlewaresRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] Middleware ${name.description} no encontrado.`);
    }
    return instance as T;
  }

  public registerPreset<T>(name: symbol, instance: T): void {
    if (this.presetsRegistry.has(name)) {
      console.warn(`[Kernel] ADVERTENCIA: Preset ${name.description} sobrescrito.`);
    }
    this.presetsRegistry.set(name, instance);
    console.log(`[Kernel] Preset registrado: ${name.description}`);
  }

  public getPreset<T>(name: symbol): T {
    const instance = this.presetsRegistry.get(name);
    if (!instance) {
      throw new Error(`[Kernel] Preset ${name.description} no encontrado.`);
    }
    return instance as T;
  }

  public registerApp(name: string, instance: IApp): void {
    if (this.appsRegistry.has(name)) {
      console.warn(`[Kernel] ADVERTENCIA: App '${name}' sobrescrita.`);
    }
    this.appsRegistry.set(name, instance);
    console.log(`[Kernel] App registrada: ${name}`);
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
    console.log("[Kernel] Iniciando...");
    console.log(`[Kernel] Modo: ${this.isDevelopment ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log(`[Kernel] Base path: ${this.basePath}`);

    // 1. Cargar Providers (I/O)
    await this.loadLayerRecursive(this.providersPath, this.loadProvider.bind(this));

    // 2. Cargar Middlewares (Lógica/Transformación)
    await this.loadLayerRecursive(this.middlewaresPath, this.loadMiddleware.bind(this));

    // 3. Cargar Presets (Utilidades reutilizables)
    await this.loadLayerRecursive(this.presetsPath, this.loadPreset.bind(this));

    // 4. Cargar Apps (Negocio) excluyendo BaseApp.ts (la clase base)
    await this.loadLayerRecursive(this.appsPath, this.loadApp.bind(this), ['BaseApp.ts']);
    
    // Iniciar watchers para carga dinámica (solo en desarrollo)
    if (this.isDevelopment) {
      this.watchLayer(this.providersPath, this.loadProvider.bind(this), this.unloadProvider.bind(this));
      this.watchLayer(this.middlewaresPath, this.loadMiddleware.bind(this), this.unloadMiddleware.bind(this));
      this.watchLayer(this.presetsPath, this.loadPreset.bind(this), this.unloadPreset.bind(this));
      this.watchLayer(this.appsPath, this.loadApp.bind(this), this.unloadApp.bind(this), ['BaseApp.ts']);
    }

    console.log("[Kernel] En funcionamiento.");
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
      console.error(`[Kernel] Error cargando Provider ${filePath}:`, e);
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
      console.error(`[Kernel] Error cargando Middleware ${filePath}:`, e);
    }
  }

  private async loadPreset(filePath: string): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const PresetClass = module.default;
      if (!PresetClass) return;

      const preset: IPreset<any> = new PresetClass();
      if (preset.initialize) {
        await preset.initialize();
      }
      
      const instance = preset.getInstance();
      this.registerPreset(preset.name, instance);
      this.presets.set(filePath, preset);
      
    } catch (e) {
      console.error(`[Kernel] Error cargando Preset ${filePath}:`, e);
    }
  }

  private async loadApp(filePath: string): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const AppClass = module.default;
      if (!AppClass) return;

      const app: IApp = new AppClass(this);
      await app.start()
      this.apps.set(filePath, app);
      
    } catch (e) {
      console.error(`[Kernel] Error cargando App ${filePath}:`, e);
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
      console.log(`Descargando provider: ${provider.name.description}`);
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
      console.log(`Descargando middleware: ${mw.name.description}`);
      await mw.shutdown?.();
      this.middlewaresRegistry.delete(mw.name);
      this.middlewares.delete(filePath);
    }
  }

  private async unloadPreset(filePath: string) {
    const preset = this.presets.get(filePath);
    if(preset) {
      console.log(`Descargando preset: ${preset.name.description}`);
      await preset.shutdown?.();
      this.presetsRegistry.delete(preset.name);
      this.presets.delete(filePath);
    }
  }
  
  private async unloadApp(filePath: string) {
    const app = this.apps.get(filePath);
    if(app) {
      console.log(`Descargando app: ${app.name}`);
      await app.stop();
      this.appsRegistry.delete(app.name);
      this.apps.delete(filePath);
    }
  }
}
