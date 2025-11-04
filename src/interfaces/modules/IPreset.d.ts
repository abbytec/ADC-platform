import { ILifecycle } from "../behaviours/ILifecycle.d.ts";
import { IKernel } from "../IKernel.js";
import { IModule } from "./IModule.js";

export const PRESET_INJECTION = Symbol.for("IPreset");

/**
 * Un Preset es un módulo que expone funcionalidad reutilizable
 * a través de métodos/funciones, sin lógica de ejecución automática
 * como las Apps.
 */
export interface IPreset<T = any> extends ILifecycle, IModule {
	/** Obtener la instancia del preset */
	getInstance(): T;
}
