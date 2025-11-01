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

/**
 * Configuración de un módulo en modules.json
 */
export interface IModuleConfig {
  /** Nombre del módulo */
  name: string;
  /** Versión a cargar - puede ser exacta (1.0.0) o con rango (^1.0.0, >=1.0.0) */
  version?: string;
  /** Lenguaje del módulo (default: 'typescript') */
  language?: string;
  /** Configuración personalizada para pasar al constructor del módulo */
  config?: Record<string, any>;
}

/**
 * Definición de los módulos requeridos por una app
 */
export interface IModulesDefinition {
  /** Si true, los errores al cargar módulos no detendrán la app */
  failOnError?: boolean;
  /** Lista de presets a cargar */
  presets?: IModuleConfig[];
  /** Lista de middlewares a cargar */
  middlewares?: IModuleConfig[];
  /** Lista de providers a cargar */
  providers?: IModuleConfig[];
}