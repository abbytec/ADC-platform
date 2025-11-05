import { ILifecycle } from "../behaviours/ILifecycle.d.ts";
import { IKernel } from "../IKernel.js";
import { IModule } from "./IModule.js";

export const PRESET_INJECTION = Symbol.for("IService");

/**
 * Un Service es un módulo que expone funcionalidad reutilizable
 * a través de métodos/funciones, sin lógica de ejecución automática
 * como las Apps.
 */
export interface IService<T = any> extends ILifecycle, IModule {
	/** Obtener la instancia del service */
	getInstance(): Promise<T>;
}
