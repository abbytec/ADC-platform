import * as path from "node:path";
import { IModulesDefinition } from "../interfaces/modules/IModule.js";
import * as fs from "node:fs/promises";
import { IService } from "../interfaces/modules/IService.js";
import { Logger } from "../utils/logger/Logger.js";
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
		const modulesConfigPath = path.join(serviceDir, "config.json");

		this.logger.logDebug(`Inicializando...`);

		try {
			let baseConfig: IModulesDefinition = {};
			try {
				const configContent = await fs.readFile(modulesConfigPath, "utf-8");
				baseConfig = JSON.parse(configContent);
			} catch {}

			// Determinar qué providers usar:
			// - Si la app proporciona providers (options.providers), usar esos
			// - Si no, cargar los del modules.json (dependencias por defecto del servicio)
			let providersToUse = this.options?.providers || [];
			
			if (!providersToUse || providersToUse.length === 0) {
				// No hay providers de la app, usar los del modules.json
				if (baseConfig.providers && Array.isArray(baseConfig.providers)) {
					providersToUse = baseConfig.providers;
					// Cargar estos providers
					for (const providerConfig of baseConfig.providers) {
						try {
							const provider = await Kernel.moduleLoader.loadProvider(providerConfig);
							this.kernel.registerProvider(provider.name, provider, provider.type, providerConfig);
							
							// También registrar por el nombre del módulo/configuración
							if (providerConfig.name !== provider.name) {
								this.kernel.registerProvider(providerConfig.name, provider, undefined, providerConfig);
							}
							
							// Agregar como dependencia de la app actual
							this.kernel.addModuleDependency("provider", providerConfig.name, providerConfig.config);
						} catch (error) {
							const message = `Error cargando provider ${providerConfig.name}: ${error}`;
							if (baseConfig.failOnError) throw new Error(message);
							this.logger.logWarn(message);
						}
					}
				}
			}

			// Cargar las utilities internas del servicio (del config.json)
			if (baseConfig.utilities && Array.isArray(baseConfig.utilities)) {
				for (const utilityConfig of baseConfig.utilities) {
					try {
						const utility = await Kernel.moduleLoader.loadUtility(utilityConfig);
						this.kernel.registerUtility(utility.name, utility, utilityConfig);
						
						// Si el nombre contiene "/", también registrar con el nombre base como alias
						if (utilityConfig.name.includes("/")) {
							const baseName = utilityConfig.name.split("/").pop()!;
							this.kernel.registerUtility(baseName, utility, utilityConfig);
						}
					} catch (error) {
						const message = `Error cargando utility ${utilityConfig.name}: ${error}`;
						if (baseConfig.failOnError) throw new Error(message);
						this.logger.logWarn(message);
					}
				}
			}

			this.config = {
				...baseConfig,
				providers: providersToUse,
				utilities: this.options?.utilities || baseConfig.utilities || [],
			};

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
	 * Obtener el utility del kernel
	 */
	protected getUtility<M>(name: string, config?: Record<string, any>): M {
		return this.kernel.getUtility<M>(name, config);
	}
}
