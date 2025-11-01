import { IApp } from "../interfaces/IApp.js";
import { IKernel } from "../interfaces/IKernel.js";
import { Logger } from "../utils/Logger.js";


/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la validación de dependencias.
 */
export abstract class BaseApp implements IApp {
  /** El nombre único de la app */
  abstract readonly name: string;

  /**
   * Las 'Apps' deben definir aquí los nombres
   * de los providers que necesitan.
   */
  protected requiredProviders: symbol[] = [];
  
  /**
   * Las 'Apps' deben definir aquí los nombres
   * de los middlewares que necesitan.
   */
  protected requiredMiddlewares: symbol[] = [];

  /**
   * Las 'Apps' deben definir aquí los nombres
   * de los presets que necesitan.
   */
  protected requiredPresets: symbol[] = [];

  protected kernel!: IKernel;

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
   * Chequea el registro del Kernel por todas las dependencias requeridas.
   * Lanza un error si falta alguna.
   */
  public checkDependencies(): void {
    Logger.info(`[${this.name}] Validando dependencias...`);

    for (const name of this.requiredProviders) {
      this.kernel.getProvider(name);
    }

    for (const name of this.requiredMiddlewares) {
      this.kernel.getMiddleware(name);
    }

    for (const name of this.requiredPresets) {
      this.kernel.getPreset(name);
    }

    Logger.ok(`[${this.name}] Todas las dependencias fueron validadas.`);
  }
}
