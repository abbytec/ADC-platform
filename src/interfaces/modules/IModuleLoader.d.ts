import { IProvider } from "./IProvider.js";
import { IMiddleware } from "./IMiddleware.js";
import { IPreset } from "./IPreset.js";
import { IKernel } from "../IKernel.ts";

/**
 * Interfaz base para loaders de módulos por lenguaje
 */
export interface IModuleLoader {
	/**
	 * Carga un Provider desde una ruta específica
	 */
	loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>>;

	/**
	 * Carga un Middleware desde una ruta específica
	 */
	loadMiddleware(modulePath: string, config?: Record<string, any>): Promise<IMiddleware<any>>;

	/**
	 * Carga un Preset desde una ruta específica
	 */
	loadPreset(modulePath: string, kernel: IKernel, config?: Record<string, any>): Promise<IPreset<any>>;

	/**
	 * Verifica si el loader puede manejar un módulo en una ruta específica
	 */
	canHandle(modulePath: string): Promise<boolean>;
}
