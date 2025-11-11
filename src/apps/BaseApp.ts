import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IApp } from "../interfaces/modules/IApp.js";
import { Logger } from "../utils/logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";
import type { UIModuleConfig } from "../interfaces/modules/IUIModule.js";
import type { IUIFederationService } from "../services/core/UIFederationService/types.js";

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
				const uiFederation = this.kernel.getService<any>("UIFederationService");
				const uiFederationInstance = await uiFederation.getInstance() as IUIFederationService;
				await uiFederationInstance.unregisterUIModule(this.config.uiModule.name);
			} catch (err) {
				this.logger.logDebug("No se pudo desregistrar módulo UI", err);
			}
		}
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

	/**
	 * Registra la app como módulo UI si tiene configuración uiModule
	 */
	async #registerUIModuleIfNeeded(): Promise<void> {
		if (!this.config?.uiModule) {
			return; // No es una app UI
		}

		try {
			const uiFederation = this.kernel.getService<any>("UIFederationService");
			const uiFederationInstance = await uiFederation.getInstance() as IUIFederationService;

			const uiConfig: UIModuleConfig = this.config.uiModule;

			// Extraer el nombre limpio (sin prefijo "web-")
			// Si el nombre de la app es "web-ui-library", el nombre del módulo UI debería ser "ui-library"
			const appBaseName = this.name.split(":")[0]; // Remover sufijo de instancia
			const cleanModuleName = uiConfig.name || (appBaseName.startsWith("web-") 
				? appBaseName.substring(4) 
				: appBaseName);

			// Actualizar el nombre en la config
			uiConfig.name = cleanModuleName;

			this.logger.logInfo(`Registrando módulo UI: ${cleanModuleName}`);
			await uiFederationInstance.registerUIModule(cleanModuleName, this.appDir, uiConfig);
			this.uiModuleRegistered = true;

			this.logger.logOk(`Módulo UI ${cleanModuleName} registrado exitosamente`);
		} catch (error: any) {
			this.logger.logWarn(`No se pudo registrar como módulo UI: ${error.message}`);
			// No lanzar error - la app puede funcionar sin UIFederationService
		}
	}
}
