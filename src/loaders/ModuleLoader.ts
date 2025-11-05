import * as path from "node:path";
import * as fs from "node:fs/promises";
import { IModuleConfig, IModulesDefinition } from "../interfaces/modules/IModule.js";
import { IProvider } from "../interfaces/modules/IProvider.js";
import { IMiddleware } from "../interfaces/modules/IMiddleware.js";
import { IPreset } from "../interfaces/modules/IPreset.js";
import { LoaderManager } from "./LoaderManager.js";
import { VersionResolver } from "../utils/VersionResolver.js";
import { Logger } from "../utils/Logger/Logger.js";
import { Kernel } from "../kernel.js";

export class ModuleLoader {
	readonly #basePath = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");

	readonly #providersPath = path.resolve(this.#basePath, "providers");
	readonly #middlewaresPath = path.resolve(this.#basePath, "middlewares");
	readonly #presetsPath = path.resolve(this.#basePath, "presets");

	readonly #configCache = new Map<string, IModuleConfig>();

	public getConfigByPath(modulePath: string): IModuleConfig | undefined {
		return this.#configCache.get(modulePath);
	}

	/**
	 * Carga todos los módulos (providers, middlewares, presets) desde un objeto de definición de módulos.
	 * Usa el contexto de carga del kernel para reference counting.
	 * @param modulesConfig - El objeto de definición de módulos.
	 * @param kernel - La instancia del kernel.
	 */
	async loadAllModulesFromDefinition(modulesConfig: IModulesDefinition, kernel: Kernel): Promise<void> {
		try {
			// Cargar providers
			if (modulesConfig.providers && Array.isArray(modulesConfig.providers)) {
				for (const providerConfig of modulesConfig.providers) {
					try {
						const provider = await this.loadProvider(providerConfig);
						const instance = await provider.getInstance(providerConfig.config);
						kernel.registerProvider(provider.name, instance, provider.type, providerConfig);
					} catch (error) {
						if (modulesConfig.failOnError) throw error;
						Logger.warn(`Error cargando provider ${providerConfig.name}: ${error}`);
					}
				}
			}

			// Cargar middlewares
			if (modulesConfig.middlewares && Array.isArray(modulesConfig.middlewares)) {
				for (const middlewareConfig of modulesConfig.middlewares) {
					try {
						const middleware = await this.loadMiddleware(middlewareConfig);
						const instance = await middleware.getInstance(middlewareConfig.config);
						kernel.registerMiddleware(middleware.name, instance, middlewareConfig);
					} catch (error) {
						if (modulesConfig.failOnError) throw error;
						Logger.warn(`Error cargando middleware ${middlewareConfig.name}: ${error}`);
					}
				}
			}

			// Cargar presets
			if (modulesConfig.presets && Array.isArray(modulesConfig.presets)) {
				for (const presetConfig of modulesConfig.presets) {
					try {
						const preset = await this.loadPreset(presetConfig, kernel);
						if (preset.start) {
							await preset.start();
						}
						const instance = preset.getInstance();
						kernel.registerPreset(preset.name, instance, presetConfig);
					} catch (error) {
						if (modulesConfig.failOnError) throw error;
						Logger.warn(`Error cargando preset ${presetConfig.name}: ${error}`);
					}
				}
			}
		} catch (error) {
			Logger.error(`Error procesando la definición de módulos: ${error}`);
			throw error;
		}
	}

	/**
	 * Carga un Provider desde su configuración.
	 */
	async loadProvider(config: IModuleConfig): Promise<IProvider<any>> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Provider: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#providersPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Provider: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = LoaderManager.getLoader(language);

		// Cargar el módulo
		return await loader.loadProvider(resolved.path, config.config);
	}

	/**
	 * Carga un Middleware desde su configuración.
	 */
	async loadMiddleware(config: IModuleConfig): Promise<IMiddleware<any>> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Middleware: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#middlewaresPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Middleware: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = LoaderManager.getLoader(language);

		// Cargar el módulo
		return await loader.loadMiddleware(resolved.path, config.config);
	}

	/**
	 * Carga un Preset desde su configuración.
	 */
	async loadPreset(config: IModuleConfig, kernel: Kernel): Promise<IPreset<any>> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Preset: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#presetsPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Preset: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = LoaderManager.getLoader(language);

		// Cargar el módulo pasando el kernel
		return await loader.loadPreset(resolved.path, kernel, config.config);
	}
}
