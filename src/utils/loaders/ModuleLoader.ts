import * as path from "node:path";
import { LoaderManager } from "./LoaderManager.js";
import { IModuleConfig, IModulesDefinition } from "../../interfaces/modules/IModule.js";
import { IProvider } from "../../interfaces/modules/IProvider.js";
import { IService } from "../../interfaces/modules/IService.js";
import { IUtility } from "../../interfaces/modules/IUtility.js";
import { Kernel } from "../../kernel.js";
import { Logger } from "../logger/Logger.js";
import { VersionResolver } from "../VersionResolver.js";

export class ModuleLoader {
	readonly #basePath = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");

	readonly #providersPath = path.resolve(this.#basePath, "providers");
	readonly #utilitiesPath = path.resolve(this.#basePath, "utilities");
	readonly #servicesPath = path.resolve(this.#basePath, "services");

	readonly #configCache = new Map<string, IModuleConfig>();

	public getConfigByPath(modulePath: string): IModuleConfig | undefined {
		return this.#configCache.get(modulePath);
	}

	/**
	 * Carga todos los módulos (providers, utilities, services) desde un objeto de definición de módulos.
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
						kernel.registerProvider(provider.name, provider, provider.type, providerConfig);
					} catch (error) {
						const message = `Error cargando provider ${providerConfig.name}: ${error}`;
						if (modulesConfig.failOnError) throw new Error(message);
						Logger.warn(message);
					}
				}
			}

			// Cargar utilities
			if (modulesConfig.utilities && Array.isArray(modulesConfig.utilities)) {
				for (const utilityConfig of modulesConfig.utilities) {
					try {
						const utility = await this.loadUtility(utilityConfig);
						kernel.registerUtility(utility.name, utility, utilityConfig);
					} catch (error) {
						const message = `Error cargando utility ${utilityConfig.name}: ${error}`;
						if (modulesConfig.failOnError) throw new Error(message);
						Logger.warn(message);
					}
				}
			}

			// Cargar services
			if (modulesConfig.services && Array.isArray(modulesConfig.services)) {
				for (const serviceConfig of modulesConfig.services) {
					try {
						const service = await this.loadService(serviceConfig, kernel);
						if (service.start) {
							await service.start();
						}
						const instance = await service.getInstance();
						kernel.registerService(service.name, instance, serviceConfig);
					} catch (error) {
						const message = `Error cargando service ${serviceConfig.name}: ${error}`;
						if (modulesConfig.failOnError) throw new Error(message);
						Logger.warn(message);
					}
				}
			}
		} catch (error) {
			const message = `Error procesando la definición de módulos: ${error}`;
			Logger.error(message);
			throw new Error(message);
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
	 * Carga un Utility desde su configuración.
	 */
	async loadUtility(config: IModuleConfig): Promise<IUtility<any>> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Utility: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#utilitiesPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Utility: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = LoaderManager.getLoader(language);

		// Cargar el módulo
		return await loader.loadUtility(resolved.path, config.config);
	}

	/**
	 * Carga un Service desde su configuración.
	 */
	async loadService(config: IModuleConfig, kernel: Kernel): Promise<IService<any>> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Service: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#servicesPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Service: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = LoaderManager.getLoader(language);

		// Cargar el módulo pasando el kernel
		return await loader.loadService(resolved.path, kernel, config.config);
	}
}
