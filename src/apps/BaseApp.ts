import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IApp } from "../interfaces/modules/IApp.js";
import { Logger } from "../utils/logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";

/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la carga de módulos desde archivos de configuración.
 */
export abstract class BaseApp implements IApp {
	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);
	protected readonly appDir: string;

	constructor(
		protected readonly kernel: Kernel,
		public readonly name: string = this.constructor.name,
		protected config?: any,
		_appFilePath?: string
	) {
		if (_appFilePath) {
			this.appDir = path.dirname(_appFilePath);
		} else {
			// Fallback para cuando no se proporciona la ruta (aunque debería hacerse siempre)
			const appDirName = this.name.split(":")[0];
			const isDevelopment = process.env.NODE_ENV === "development";
			this.appDir = isDevelopment
				? path.resolve(process.cwd(), "src", "apps", appDirName)
				: path.resolve(process.cwd(), "dist", "apps", appDirName);
		}
	}

	/**
	 * Lógica de inicialización.
	 */
	public async start() {
		/* noop */
	}

	/**
	 * La lógica de negocio de la app.
	 */
	abstract run(): Promise<void>;

	/**
	 * Lógica de detención.
	 */
	public async stop() {
		/* noop */
	}

	/**
	 * Combina la configuración de `default.json` (base) con la configuración
	 * de la instancia específica de la app.
	 */
	async #mergeModuleConfigs(): Promise<void> {
		const appDir = this.appDir;

		let baseConfig: any = {};
		try {
			const defaultConfigPath = path.join(appDir, "default.json");
			const content = await fs.readFile(defaultConfigPath, "utf-8");
			baseConfig = JSON.parse(content);
		} catch {
			// No hay archivo default.json, lo cual es aceptable.
		}

		const instanceConfig = this.config || {};

	// Función auxiliar para fusionar módulos por nombre
	const mergeModules = (base: any[] = [], instance: any[] = []): any[] => {
		const byName = new Map(base.map((item) => [item.name, item]));
		for (const item of instance) {
			const existing = byName.get(item.name) || {};
			byName.set(item.name, { ...existing, ...item });
		}
		return Array.from(byName.values());
	};

	const mergedProviders = mergeModules(baseConfig.providers, instanceConfig.providers);
	const mergedUtilities = mergeModules(baseConfig.utilities, instanceConfig.utilities);
	const mergedServices = mergeModules(baseConfig.services, instanceConfig.services);
	
	// Los servicios SIN providers propios heredan los globales
	// Esto permite que usen la configuración correcta del provider global
	const servicesWithInheritedProviders = mergedServices.map((service: any) => {
		if (!service.providers || service.providers.length === 0) {
			return { ...service, providers: mergedProviders };
		}
		return service;
	});

	const mergedConfig: any = {
		...baseConfig,
		...instanceConfig,
		failOnError: instanceConfig.failOnError ?? baseConfig.failOnError,
		providers: mergedProviders,
		utilities: mergedUtilities,
		services: servicesWithInheritedProviders,
	};

		this.config = mergedConfig;
		Object.freeze(this.config); // Freezes config from modifications
	}

	/**
	 * Carga los módulos de la app después de combinar las configuraciones.
	 */
	public async loadModulesFromConfig(): Promise<void> {
		try {
			await this.#mergeModuleConfigs();
			if (this.config) {
				await Kernel.moduleLoader.loadAllModulesFromDefinition(this.config, this.kernel);
			}
		} catch (error) {
			this.logger.logError(`Error procesando la configuración de módulos: ${error}`);
			throw error;
		}
	}
}
