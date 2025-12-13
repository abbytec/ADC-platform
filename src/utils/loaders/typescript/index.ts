import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IModuleLoader } from "../../../interfaces/modules/IModuleLoader.js";
import { IModuleConfig } from "../../../interfaces/modules/IModule.js";
import type { IProvider } from "../../../providers/BaseProvider.ts";
import type { IUtility } from "../../../utilities/BaseUtility.ts";
import type { IService } from "../../../services/BaseService.ts";

import { Kernel } from "../../../kernel.js";
import { Logger } from "../../logger/Logger.js";

type Constructor<T> = new (...args: any[]) => T;

export class TypeScriptLoader implements IModuleLoader {
	readonly #extension = process.env.NODE_ENV === "development" ? ".ts" : ".js";

	async canHandle(modulePath: string): Promise<boolean> {
		try {
			await fs.stat(path.join(modulePath, `index${this.#extension}`));
			return true;
		} catch {
			return false;
		}
	}

	async loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>> {
		const ProviderClass = await this.importClass<IProvider<any>>(modulePath, "Provider");
		return new ProviderClass(this.enrichConfig(modulePath, config));
	}

	async loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility<any>> {
		const UtilityClass = await this.importClass<IUtility<any>>(modulePath, "Utility");
		return new UtilityClass(this.enrichConfig(modulePath, config));
	}

	async loadService(modulePath: string, kernel: Kernel, config?: Record<string, any> | IModuleConfig): Promise<IService<any>> {
		const ServiceClass = await this.importClass<IService<any>>(modulePath, "Service");
		// Service recibe argumentos distintos (kernel + config), por lo que lo instanciamos diferente
		return new ServiceClass(kernel, config);
	}

	/**
	 * Helper centralizado para importar módulos dinámicamente y validar su estructura.
	 */
	private async importClass<T>(modulePath: string, role: string): Promise<Constructor<T>> {
		try {
			const indexFile = path.join(modulePath, `index${this.#extension}`);
			// Cache busting para recarga en caliente
			const module = await import(`${indexFile}?v=${Date.now()}`);
			const ModuleClass = module.default;

			if (!ModuleClass) {
				throw new Error(`El módulo ${indexFile} no tiene un export default.`);
			}

			return ModuleClass as Constructor<T>;
		} catch (error) {
			Logger.error(`[TypeScriptLoader] Error cargando ${role}: ${error}`);
			throw error;
		}
	}

	/**
	 * Normaliza la configuración inyectando metadatos del módulo.
	 */
	private enrichConfig(modulePath: string, config?: Record<string, any>): Record<string, any> {
		return {
			...config,
			moduleName: config?.moduleName || path.basename(modulePath),
			moduleVersion: config?.moduleVersion || "latest",
			language: config?.language || "typescript",
		};
	}
}

export default TypeScriptLoader;
