import { IKernel } from "./IKernel.js";

export interface IModule {
  /** Un nombre único para el módulo (ej: "calendar-app") */
  name: string;

  /**
   * Método llamado por el Kernel cuando el módulo es cargado.
   * Aquí es donde el módulo se registra (si es Proveedor)
   * o pide capacidades (si es Consumidor).
   */
  start(kernel: IKernel): Promise<void>;

  /**
   * Método llamado por el Kernel antes de descargar el módulo.
   * Útil para cerrar conexiones de base de datos, etc.
   */
  stop(): Promise<void>;
}