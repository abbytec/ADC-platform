import { IApp } from "../interfaces/IApp.js";
import { IKernel } from "../interfaces/IKernel.js";


/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la validación de dependencias.
 */
export abstract class BaseApp implements IApp {
  /** El nombre único de la app */
  abstract name: string;

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

  /**
   * El Kernel llama a start()
   */
  public async start(kernel: IKernel): Promise<void> {
    this.kernel = kernel;

    // 1. Validar que todas las dependencias existan
    try {
      this.checkDependencies();
    } catch (e: any) {
      console.error(e.message);
      // Detenemos la carga de esta app si faltan dependencias
      return; 
    }

    // 2. Si está OK, ejecutar la lógica principal de la app
    console.log(`[App: ${this.name}] Iniciando...`);
    await this.run();
  }

  /**
   * La lógica de negocio de la app.
   */
  abstract run(): Promise<void>;

  /**
   * Lógica de detención.
   */
  abstract stop(): Promise<void>;

  /**
   * Chequea el registro del Kernel por todas las dependencias requeridas.
   * Lanza un error si falta alguna.
   */
  private checkDependencies(): void {
    console.log(`[App: ${this.name}] Validando dependencias...`);

    for (const name of this.requiredProviders) {
      this.kernel.getProvider(name);
    }

    for (const name of this.requiredMiddlewares) {
      this.kernel.getMiddleware(name);
    }

    for (const name of this.requiredPresets) {
      this.kernel.getPreset(name);
    }

    console.log(`[App: ${this.name}] Todas las dependencias fueron validadas.`);
  }
}
