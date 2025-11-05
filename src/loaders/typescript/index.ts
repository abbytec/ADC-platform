import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IModuleLoader } from "../../interfaces/modules/IModuleLoader.js";
import { IProvider } from "../../interfaces/modules/IProvider.js";
import { IMiddleware } from "../../interfaces/modules/IMiddleware.js";
import { IPreset } from "../../interfaces/modules/IPreset.js";
import { Logger } from "../../utils/Logger/Logger.js";
import { Kernel } from "../../kernel.js";

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

	async loadMiddleware(modulePath: string, config?: Record<string, any>): Promise<IMiddleware<any>> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			const module = await import(`${indexFile}?v=${Date.now()}`);
			const MiddlewareClass = module.default;

			if (!MiddlewareClass) {
				throw new Error(`No hay export default en ${indexFile}`);
			}

			const middleware: IMiddleware<any> = new MiddlewareClass(config);
			return middleware;
		} catch (error) {
			Logger.error(`[TypeScriptLoader] Error cargando Middleware: ${error}`);
			throw error;
		}
	}

	async loadPreset(modulePath: string, kernel: Kernel, config?: Record<string, any>): Promise<IPreset<any>> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			const module = await import(`${indexFile}?v=${Date.now()}`);
			const PresetClass = module.default;

			if (!PresetClass) {
				throw new Error(`No hay export default en ${indexFile}`);
			}

			const preset: IPreset<any> = new PresetClass(kernel, config);
			return preset;
		} catch (error) {
			Logger.error(`[TypeScriptLoader] Error cargando Preset: ${error}`);
			throw error;
		}
	}
}

export default TypeScriptLoader;
