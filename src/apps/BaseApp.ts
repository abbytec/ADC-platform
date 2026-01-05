import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IApp } from "../interfaces/modules/IApp.js";
import { Logger } from "../utils/logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";
import { IModuleConfig } from "../interfaces/modules/IModule.js";
import type { UIModuleConfig } from "../interfaces/modules/IUIModule.js";
import UIFederationService from "../services/core/UIFederationService/index.ts";

/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la carga de módulos desde archivos de configuración.
 * Soporta apps UI que se registran automáticamente en UIFederationService.
 */
export abstract class BaseApp implements IApp {
	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);
	protected readonly appDir: string;
	private uiModuleRegistered = false;

	constructor(
		protected readonly kernel: Kernel,
		public readonly name: string = this.constructor.name,
		protected config?: IModuleConfig,
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
	public async start(_kernelKey: symbol): Promise<void> {
		// Si la app tiene configuración UI, registrarla en UIFederationService
		await this.#registerUIModuleIfNeeded();
	}

	/**
	 * La lógica de negocio de la app.
	 */
	abstract run(): Promise<void>;

	/**
	 * Lógica de detención.
	 */
	public async stop() {
		// Desregistrar módulo UI si estaba registrado
		if (this.uiModuleRegistered && this.config?.uiModule) {
			try {
				const uiFederation = this.kernel.getService<UIFederationService>("UIFederationService");
				await uiFederation.unregisterUIModule(this.config.uiModule.name);
			} catch (err) {
				this.logger.logDebug("No se pudo desregistrar módulo UI", err);
			}
		}
	}

	/**
	 * Obtiene un provider que fue cargado por esta app según su configuración.
	 * Esto asegura que se obtiene la instancia correcta cuando hay múltiples providers del mismo tipo.
	 * @param name - Nombre del provider
	 * @returns La instancia del provider
	 */
	protected getMyProvider<P>(name: string): P {
		// Buscar el provider en la configuración de esta app
		const providerConfig = this.config?.providers?.find((p) => p.name === name);
		if (!providerConfig) {
			throw new Error(`Provider ${name} no está configurado en la app ${this.name}`);
		}
		// El kernel usa config.custom para generar el uniqueKey
		return this.kernel.getProvider<P>(name, providerConfig.custom);
	}

	/**
	 * Obtiene un service que fue cargado por esta app según su configuración.
	 * @param name - Nombre del service
	 * @returns La instancia del service
	 */
	protected getMyService<S>(name: string): S {
		// Buscar el service en la configuración de esta app
		const serviceConfig = this.config?.services?.find((s: any) => s.name === name);
		if (!serviceConfig) {
			throw new Error(`Service ${name} no está configurado en la app ${this.name}`);
		}
		// El kernel usa config.custom para generar el uniqueKey
		return this.kernel.getService<S>(name, serviceConfig.custom);
	}

	/**
	 * Obtiene una utility que fue cargada por esta app según su configuración.
	 * @param name - Nombre de la utility
	 * @returns La instancia de la utility
	 */
	protected getMyUtility<U>(name: string): U {
		// Buscar la utility en la configuración de esta app
		const utilityConfig = this.config?.utilities?.find((u) => u.name === name);
		if (!utilityConfig) {
			throw new Error(`Utility ${name} no está configurada en la app ${this.name}`);
		}
		// El kernel usa config.custom para generar el uniqueKey
		return this.kernel.getUtility<U>(name, utilityConfig.custom);
	}

	async #mergeModuleConfigs(): Promise<void> {
		const appDir = this.appDir;

		let baseConfig: Partial<IModuleConfig> = {};
		try {
			const defaultConfigPath = path.join(appDir, "default.json");
			const content = await fs.readFile(defaultConfigPath, "utf-8");
			baseConfig = JSON.parse(content);
		} catch {
			// No hay archivo default.json, lo cual es aceptable.
		}

		const instanceConfig: Partial<IModuleConfig> = this.config || {};

		// Función auxiliar para fusionar módulos por nombre
		const mergeModules = (base: IModuleConfig[] = [], instance: IModuleConfig[] = []): IModuleConfig[] => {
			const byName = new Map(base.map((item) => [item.name, item]));
			for (const item of instance) {
				const existing = byName.get(item.name) || {};
				byName.set(item.name, { ...existing, ...item } as IModuleConfig);
			}
			return Array.from(byName.values());
		};

		const mergedProviders = mergeModules(baseConfig.providers, instanceConfig.providers);
		const mergedUtilities = mergeModules(baseConfig.utilities, instanceConfig.utilities);
		const mergedServices = mergeModules(baseConfig.services, instanceConfig.services);

		// Los servicios SIN providers propios heredan los globales
		// Esto permite que usen la configuración correcta del provider global
		const servicesWithInheritedProviders = mergedServices.map((service: IModuleConfig) => {
			if (!service.providers || service.providers.length === 0) {
				return { ...service, providers: mergedProviders };
			}
			return service;
		});

		const mergedConfig: Partial<IModuleConfig> = {
			...baseConfig,
			...instanceConfig,
			failOnError: instanceConfig.failOnError ?? baseConfig.failOnError,
			providers: mergedProviders,
			utilities: mergedUtilities,
			services: servicesWithInheritedProviders,
		};

		this.config = mergedConfig as IModuleConfig;
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

	/**
	 * Registra la app como módulo UI si tiene configuración uiModule
	 */
	async #registerUIModuleIfNeeded(): Promise<void> {
		if (!this.config?.uiModule) {
			return; // No es una app UI
		}

		try {
			const uiFederationService = this.kernel.getService<UIFederationService>("UIFederationService");

			const uiConfig: UIModuleConfig = this.config.uiModule;

			// Extraer el nombre limpio (sin prefijo "web-")
			// Si el nombre de la app es "web-ui-library", el nombre del módulo UI debería ser "ui-library"
			const appBaseName = this.name.split(":")[0]; // Remover sufijo de instancia
			const cleanModuleName = uiConfig.name || (appBaseName.startsWith("web-") ? appBaseName.substring(4) : appBaseName);

			// Actualizar el nombre en la config
			uiConfig.name = cleanModuleName;

			this.logger.logInfo(`Registrando módulo UI: ${cleanModuleName}`);
			await uiFederationService.registerUIModule(cleanModuleName, this.appDir, uiConfig);
			this.uiModuleRegistered = true;

			this.logger.logOk(`Módulo UI ${cleanModuleName} registrado exitosamente`);
		} catch (error: any) {
			this.logger.logWarn(`No se pudo registrar como módulo UI: ${error.message}`);
			// No lanzar error - la app puede funcionar sin UIFederationService
		}
	}
}
