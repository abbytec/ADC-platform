import * as path from "node:path";
import { IModulesDefinition } from "../interfaces/modules/IModule.js";
import * as fs from "node:fs/promises";
import { IService } from "../interfaces/modules/IService.js";
import { Logger } from "../utils/Logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";

/**
 * Clase base abstracta para todos los Services.
 * Maneja la inyección del Kernel y la carga de módulos desde modules.json.
 */
export abstract class BaseService<T = any> implements IService<T> {
	/** Nombre único del service */
	abstract readonly name: string;

	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);
	protected config: IModulesDefinition;

	constructor(protected readonly kernel: Kernel, protected readonly options?: any) {
		this.config = {};
	}

	/**
	 * Obtener la instancia del service
	 */
	abstract getInstance(): Promise<T>;

	/**
	 * Lógica de inicialización del service
	 */
	public async start(): Promise<void> {
		const serviceDir = this.getServiceDir();
		const modulesConfigPath = path.join(serviceDir, "modules.json");

		this.logger.logDebug(`Inicializando y cargando módulos...`);

		try {
			let baseConfig: IModulesDefinition = {};
			try {
				const configContent = await fs.readFile(modulesConfigPath, "utf-8");
				baseConfig = JSON.parse(configContent);
			} catch {}

			const mergedConfig: IModulesDefinition = structuredClone(baseConfig);

			if (this.options?.modules) {
				const optModules = this.options.modules;

				// Fusionar providers
				if (optModules.providers) {
					mergedConfig.providers ??= [];
					for (const provider of optModules.providers) {
						const index = mergedConfig.providers.findIndex((p) => p.name === provider.name);
						if (index > -1) {
							mergedConfig.providers[index] = { ...mergedConfig.providers[index], ...provider };
						} else {
							mergedConfig.providers.push(provider);
						}
					}
				}

				// Fusionar middlewares
				if (optModules.middlewares) {
					mergedConfig.middlewares ??= [];
					for (const middleware of optModules.middlewares) {
						const index = mergedConfig.middlewares.findIndex((m) => m.name === middleware.name);
						if (index > -1) {
							mergedConfig.middlewares[index] = { ...mergedConfig.middlewares[index], ...middleware };
						} else {
							mergedConfig.middlewares.push(middleware);
						}
					}
				}

				// Fusionar services (si es necesario en el futuro)
				if (optModules.services) {
					mergedConfig.services ??= [];
					for (const service of optModules.services) {
						const index = mergedConfig.services.findIndex((p) => p.name === service.name);
						if (index > -1) {
							mergedConfig.services[index] = { ...mergedConfig.services[index], ...service };
						} else {
							mergedConfig.services.push(service);
						}
					}
				}
			}

			this.config = mergedConfig;
			await Kernel.moduleLoader.loadAllModulesFromDefinition(this.config, this.kernel);

			this.logger.logOk(`Inicialización completada`);
		} catch (error) {
			this.logger.logError(`Error durante inicialización: ${error}`);
			throw error;
		}
	}

	/**
	 * Lógica de cierre del service
	 */
	public async stop(): Promise<void> {
		this.logger.logOk(`Detenido.`);
	}

	/**
	 * Resuelve el directorio del service según el entorno
	 */
	protected getServiceDir(): string {
		const isDevelopment = process.env.NODE_ENV === "development";
		const serviceName = this.constructor.name
			.replace(/Service$/, "")
			.replaceAll(/([A-Z])/g, "-$1")
			.toLowerCase()
			.replace(/^-/, "");

		const serviceDir = isDevelopment
			? path.resolve(process.cwd(), "src", "services", serviceName)
			: path.resolve(process.cwd(), "dist", "services", serviceName);

		return serviceDir;
	}

	/**
	 * Obtener el provider del kernel
	 */
	protected getProvider<P>(name: string, config?: Record<string, any>): P {
		return this.kernel.getProvider<P>(name, config);
	}

	/**
	 * Obtener el middleware del kernel
	 */
	protected getMiddleware<M>(name: string, config?: Record<string, any>): M {
		return this.kernel.getMiddleware<M>(name, config);
	}
}
