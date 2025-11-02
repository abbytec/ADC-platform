import { IModuleConfig } from "./IModule.js";

/**
 * Identificador único para inyectar el propio Kernel
 * si un módulo lo necesitara.
 */
export const KERNEL_INJECTION = Symbol.for("IKernel");

export interface IKernel {
	registerProvider<T>(name: string, instance: T, type: string | undefined, config: IModuleConfig): void;
	getProvider<T>(name: string, config?: Record<string, any>): T;

	registerMiddleware<T>(name: string, instance: T, config: IModuleConfig): void;
	getMiddleware<T>(name: string, config?: Record<string, any>): T;

	registerPreset<T>(name: string, instance: T, config: IModuleConfig): void;
	getPreset<T>(name: string, config?: Record<string, any>): T;

	registerApp(name: string, instance: any): void;
	getApp(name: string): any;
}