import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IModuleLoader } from "../../../interfaces/modules/IModuleLoader.js";
import { IProvider } from "../../../interfaces/modules/IProvider.js";
import { IService } from "../../../interfaces/modules/IService.js";
import { IUtility } from "../../../interfaces/modules/IUtility.js";
import { Kernel } from "../../../kernel.js";
import { Logger } from "../../logger/Logger.js";

export class TypeScriptLoader implements IModuleLoader {
	readonly #extension = process.env.NODE_ENV === "development" ? ".ts" : ".js";

	async canHandle(modulePath: string): Promise<boolean> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			await fs.stat(indexFile);
			return true;
		} catch {
			return false;
		}
	}

	async loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			const module = await import(`${indexFile}?v=${Date.now()}`);
			const ProviderClass = module.default;

			if (!ProviderClass) {
				throw new Error(`No hay export default en ${indexFile}`);
			}

			const provider: IProvider<any> = new ProviderClass(config);
			return provider;
		} catch (error) {
			Logger.error(`[TypeScriptLoader] Error cargando Provider: ${error}`);
			throw error;
		}
	}

	async loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility<any>> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			const module = await import(`${indexFile}?v=${Date.now()}`);
			const UtilityClass = module.default;

			if (!UtilityClass) {
				throw new Error(`No hay export default en ${indexFile}`);
			}

			const utility: IUtility<any> = new UtilityClass(config);
			return utility;
		} catch (error) {
			Logger.error(`[TypeScriptLoader] Error cargando Utility: ${error}`);
			throw error;
		}
	}

	async loadService(modulePath: string, kernel: Kernel, config?: Record<string, any>): Promise<IService<any>> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			const module = await import(`${indexFile}?v=${Date.now()}`);
			const ServiceClass = module.default;

			if (!ServiceClass) {
				throw new Error(`No hay export default en ${indexFile}`);
			}

			const service: IService<any> = new ServiceClass(kernel, config);
			return service;
		} catch (error) {
			Logger.error(`[TypeScriptLoader] Error cargando Service: ${error}`);
			throw error;
		}
	}
}

export default TypeScriptLoader;
