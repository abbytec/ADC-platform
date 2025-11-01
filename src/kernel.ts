
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import chokidar from 'chokidar';
import { IKernel, KERNEL_INJECTION } from './interfaces/IKernel.js';
import { IApp } from './interfaces/IApp.js';
import { IMiddleware } from './interfaces/IMIddleware.js';
import { IProvider } from './interfaces/IProvider.js';

export class Kernel implements IKernel {
  // --- Registros ---
  private readonly capabilities = new Map<symbol, any>();
  private readonly providers = new Map<string, IProvider<any>>();
  private readonly middlewares = new Map<string, IMiddleware<any>>();
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
    await this.loadLayer(this.providersPath, this.loadProvider.bind(this));

    // 2. Cargar Middlewares (Lógica/Transformación)
    await this.loadLayer(this.middlewaresPath, this.loadMiddleware.bind(this));

    // 3. Cargar Apps (Negocio)
    // Excluimos App.ts (la clase base)
    await this.loadLayer(this.appsPath, this.loadApp.bind(this), ['App.ts']);
    
    // Iniciar watchers para carga dinámica (solo en desarrollo)
    if (this.isDevelopment) {
      this.watchLayer(this.providersPath, this.loadProvider.bind(this), this.unloadProvider.bind(this));
      this.watchLayer(this.middlewaresPath, this.loadMiddleware.bind(this), this.unloadMiddleware.bind(this));
      this.watchLayer(this.appsPath, this.loadApp.bind(this), this.unloadApp.bind(this), ['App.ts']);
    }

    console.log("[Kernel] En funcionamiento.");
  }

  // --- Métodos de Carga (Abstraídos) ---

  /**
   * Carga recursivamente todos los 'index.ts'/'index.js' en una capa.
   */
  private async loadLayer(
    dir: string, 
    loader: (entryPath: string) => Promise<void>,
    exclude: string[] = []
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (exclude.includes(entry.name)) continue;

        if (entry.isDirectory()) {
          // Asumimos que el punto de entrada es 'index.ts'/'index.js'
          const indexPath = path.join(entryPath, `index${this.fileExtension}`);
          try {
            if ((await fs.stat(indexPath)).isFile()) {
              await loader(indexPath);
            }
          } catch (e) {
            // No hay index, seguir buscando recursivamente
            await this.loadLayer(entryPath, loader, exclude);
          }
        }
      }
    } catch (e) {
      console.warn(`[Kernel] No se pudo leer la capa: ${dir}`);
    }
  }

  private async loadProvider(filePath: string, options?: any): Promise<void> {
    try {
      const module = await import(`${filePath}?v=${Date.now()}`);
      const ProviderClass = module.default;
      if (!ProviderClass) return;

      const provider: IProvider<any> = new ProviderClass();
      const instance = await provider.getInstance(options);
      
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
      // TODO: Des-registrar la capacidad y avisar a las apps que dependen de ella
      console.log(`Descargando provider: ${provider.capability.description}`);
      await provider.shutdown?.();
      this.capabilities.delete(provider.capability);
      this.providers.delete(filePath);
    }
  }
  
  private async unloadMiddleware(filePath: string) {
    const mw = this.middlewares.get(filePath);
    if(mw) {
      // TODO: Des-registrar la capacidad
      console.log(`Descargando middleware: ${mw.capability.description}`);
      await mw.shutdown?.();
      this.capabilities.delete(mw.capability);
      this.middlewares.delete(filePath);
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
