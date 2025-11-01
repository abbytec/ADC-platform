
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import chokidar from 'chokidar';
import { IKernel, KERNEL_INJECTION } from './interfaces/IKernel.js';
import { IApp } from './interfaces/IApp.js';
import { IMiddleware } from './interfaces/IMIddleware.js';
import { IProvider } from './interfaces/IProvider.js';
import { IPreset } from './interfaces/IPreset.js';

export class Kernel implements IKernel {
  // --- Registros ---
  private readonly capabilities = new Map<symbol, any>();
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

  constructor() {
    this.register(KERNEL_INJECTION, this);
  }

  // --- API Pública del Kernel ---
  public register<T>(capability: symbol, instance: T): void {
    if (this.capabilities.has(capability)) {
      console.warn(`[Kernel] ADVERTENCIA: Capacidad ${capability.description} sobrescrita.`);
    }
    this.capabilities.set(capability, instance);
    console.log(`[Kernel] Capacidad registrada: ${capability.description}`);
  }

  public get<T>(capability: symbol): T {
    const instance = this.capabilities.get(capability);
    if (!instance) {
      throw new Error(`[Kernel] Capacidad ${capability.description} no encontrada.`);
    }
    return instance as T;
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
      
      this.register(provider.capability, instance);
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
      
      this.register(middleware.capability, instance);
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
      this.register(preset.capability, instance);
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

      const app: IApp = new AppClass();
      await app.start(this); // Inicia la app (y su chequeo de dependencias)
      this.apps.set(filePath, app);
      
    } catch (e) {
      console.error(`[Kernel] Error cargando App ${filePath}:`, e);
    }
  }
  
  // --- Lógica de Watchers y Descarga (Simplificada) ---
  
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
      console.log(`Descargando provider: ${provider.capability.description}`);
      await provider.shutdown?.();
      this.capabilities.delete(provider.capability);
      this.providers.delete(filePath);
    }
  }
  
  private async unloadMiddleware(filePath: string) {
    const mw = this.middlewares.get(filePath);
    if(mw) {
      console.log(`Descargando middleware: ${mw.capability.description}`);
      await mw.shutdown?.();
      this.capabilities.delete(mw.capability);
      this.middlewares.delete(filePath);
    }
  }

  private async unloadPreset(filePath: string) {
    const preset = this.presets.get(filePath);
    if(preset) {
      console.log(`Descargando preset: ${preset.capability.description}`);
      await preset.shutdown?.();
      this.capabilities.delete(preset.capability);
      this.presets.delete(filePath);
    }
  }
  
  private async unloadApp(filePath: string) {
    const app = this.apps.get(filePath);
    if(app) {
      console.log(`Descargando app: ${app.name}`);
      await app.stop();
      this.apps.delete(filePath);
    }
  }
}
