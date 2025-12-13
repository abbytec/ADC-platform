import TypeScriptLoader from "./typescript/index.js";
import PythonLoader from "./python/index.js";
import { IModuleLoader } from "../../interfaces/modules/IModuleLoader.js";
import { Logger } from "../logger/Logger.js";
import CppLoader from "./cpp/index.ts";

export class LoaderManager {
	static readonly #loaders: Map<string, IModuleLoader> = new Map<string, IModuleLoader>([
		["typescript", new TypeScriptLoader()],
		["ts", new TypeScriptLoader()],
		["python", new PythonLoader()],
		["py", new PythonLoader()],
		["cpp", new CppLoader()],
	]);

	/**
	 * Obtiene el loader para un lenguaje específico
	 */
	static getLoader(language: string): IModuleLoader {
		const normalized = language.toLowerCase();
		const loader = this.#loaders.get(normalized);

		if (!loader) {
			Logger.warn(`[LoaderManager] No hay loader para el lenguaje: ${language}`);
			// Retorna TypeScript por defecto
			return new TypeScriptLoader();
		}

		return loader;
	}

	/**
	 * Registra un nuevo loader para un lenguaje
	 */
	static registerLoader(language: string, loader: IModuleLoader): void {
		this.#loaders.set(language.toLowerCase(), loader);
		Logger.info(`[LoaderManager] Loader registrado para: ${language}`);
	}

	/**
	 * Obtiene todos los lenguajes soportados
	 */
	static getSupportedLanguages(): string[] {
		return Array.from(this.#loaders.keys());
	}
}
