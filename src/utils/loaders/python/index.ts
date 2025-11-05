import { IModuleLoader } from "../../../interfaces/modules/IModuleLoader.js";
import { IProvider } from "../../../interfaces/modules/IProvider.js";
import { IService } from "../../../interfaces/modules/IService.js";
import { IUtility } from "../../../interfaces/modules/IUtility.js";
import { Logger } from "../../logger/Logger.js";

/**
 * Loader para módulos Python
 * Nota: Implementación futura. Por ahora lanza un error.
 */
export class PythonLoader implements IModuleLoader {
	async canHandle(modulePath: string): Promise<boolean> {
		Logger.warn("[PythonLoader] Python loader aún no está implementado");
		return false;
	}

	async loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>> {
		throw new Error("[PythonLoader] Python loader aún no está implementado");
	}

	async loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility<any>> {
		throw new Error("[PythonLoader] Python loader aún no está implementado");
	}

	async loadService(modulePath: string, config?: Record<string, any>): Promise<IService<any>> {
		throw new Error("[PythonLoader] Python loader aún no está implementado");
	}
}

export default PythonLoader;
