/**
 * Identificador único para inyectar el propio Kernel
 * si un módulo lo necesitara.
 */
export const KERNEL_INJECTION = Symbol.for("IKernel");

export interface IKernel {
  registerProvider<T>(name: symbol, instance: T, type: symbol): void;
  getProvider<T>(name: symbol): T;

  registerMiddleware<T>(name: symbol, instance: T): void;
  getMiddleware<T>(name: symbol): T;

  registerPreset<T>(name: symbol, instance: T): void;
  getPreset<T>(name: symbol): T;

  registerApp(name: string, instance: any): void;
  getApp(name: string): any;
}