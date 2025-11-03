import { IKernel } from "../IKernel.js";

export const PRESET_INJECTION = Symbol.for("IPreset");

/**
 * Un Preset es un módulo que expone funcionalidad reutilizable
 * a través de métodos/funciones, sin lógica de ejecución automática
 * como las Apps.
 */
export interface IPreset<T = any> {
	/** Nombre único del preset */
	name: string;

	/** Obtener la instancia del preset */
	getInstance(): T;

	/** Opcional: lógica de inicialización */
	initialize?(): Promise<void>;

	/** Opcional: lógica de cierre */
	shutdown?(): Promise<void>;
}
