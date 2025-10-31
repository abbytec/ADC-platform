/**
 * Identificador único para inyectar el propio Kernel
 * si un módulo lo necesitara.
 */
export const KERNEL_INJECTION = Symbol.for("IKernel");

export interface IKernel {
  /**
   * Registra una instancia concreta que satisface una capacidad.
   * @param capability El Symbol que identifica la capacidad (ej: STORAGE_CAPABILITY)
   * @param instance La instancia de la clase (ej: new FileStorage())
   */
  register<T>(capability: symbol, instance: T): void;

  /**
   * Obtiene la instancia de una capacidad registrada.
   * @param capability El Symbol de la capacidad deseada.
   * @returns La instancia que provee esa capacidad.
   */
  get<T>(capability: symbol): T;
}