import { IKernel } from "../IKernel.ts";
import type { IProvider } from "../../providers/BaseProvider.ts";
import type { IUtility } from "../../utilities/BaseUtility.ts";
import type { IService } from "../../services/BaseService.ts";

/**
 * Interfaz base para loaders de módulos por lenguaje
 */
export interface IModuleLoader {
	/**
	 * Carga un Provider desde una ruta específica
	 */
	loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>>;

	/**
	 * Carga un Utility desde una ruta específica
	 */
	loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility<any>>;

	/**
	 * Carga un Service desde una ruta específica
	 */
	loadService(modulePath: string, kernel: IKernel, config?: Record<string, any>): Promise<IService<any>>;

	/**
	 * Verifica si el loader puede manejar un módulo en una ruta específica
	 */
	canHandle(modulePath: string): Promise<boolean>;
}
