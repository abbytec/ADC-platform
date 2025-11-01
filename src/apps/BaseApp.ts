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
   * Las 'Apps' hijas deben definir aquí las capacidades
   * de I/O que necesitan (ej: STORAGE_CAPABILITY)
   */
  protected requiredProviders: symbol[] = [];
  
  /**
   * Las 'Apps' hijas deben definir aquí las capacidades
   * de lógica que necesitan (ej: JSON_ADAPTER_CAPABILITY)
   */
  protected requiredMiddlewares: symbol[] = [];

  /**
   * Las 'Apps' hijas deben definir aquí las capacidades
   * de utilidad que necesitan (ej: JSON_FILE_CRUD_CAPABILITY)
   */
  protected requiredPresets: symbol[] = [];

  /** El Kernel inyectado, disponible para las clases hijas */
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
   * La lógica de negocio de la app (implementada por la hija).
   */
  abstract run(): Promise<void>;

  /**
   * Lógica de detención (implementada por la hija).
   */
  abstract stop(): Promise<void>;

  /**
   * Chequea el registro del Kernel por todas las dependencias requeridas.
   * Lanza un error si falta alguna.
   */
  private checkDependencies(): void {
    console.log(`[App: ${this.name}] Validando dependencias...`);
    const allDeps = [...this.requiredProviders, ...this.requiredMiddlewares, ...this.requiredPresets];

    for (const capabilitySymbol of allDeps) {
        this.kernel.get(capabilitySymbol);
    }
    console.log(`[App: ${this.name}] Todas las dependencias fueron validadas.`);
  }
}
