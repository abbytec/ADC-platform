import { IModuleLoader } from "../IModuleLoader.js";
import { IProvider } from "../../interfaces/modules/IProvider.js";
import { IMiddleware } from "../../interfaces/modules/IMiddleware.js";
import { IPreset } from "../../interfaces/modules/IPreset.js";
import { Logger } from "../../utils/Logger/Logger.js";

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

	async loadMiddleware(modulePath: string, config?: Record<string, any>): Promise<IMiddleware<any>> {
		throw new Error("[PythonLoader] Python loader aún no está implementado");
	}

	async loadPreset(modulePath: string, config?: Record<string, any>): Promise<IPreset<any>> {
		throw new Error("[PythonLoader] Python loader aún no está implementado");
	}
}

export default PythonLoader;
