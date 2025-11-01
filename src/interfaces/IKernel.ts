/**
 * Identificador único para inyectar el propio Kernel
 * si un módulo lo necesitara.
 */
export const KERNEL_INJECTION = Symbol.for("IKernel");

export interface IKernel {
  registerProvider<T>(name: string, instance: T, type: string): void;
  getProvider<T>(name: string): T;

  registerMiddleware<T>(name: string, instance: T): void;
  getMiddleware<T>(name: string): T;

  registerPreset<T>(name: string, instance: T): void;
  getPreset<T>(name: string): T;

  registerApp(name: string, instance: any): void;
  getApp(name: string): any;
}