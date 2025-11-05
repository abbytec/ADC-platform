import * as path from "node:path";
import { IModulesDefinition } from "../interfaces/modules/IModule.js";
import * as fs from "node:fs/promises";
import { IPreset } from "../interfaces/modules/IPreset.js";
import { Logger } from "../utils/Logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";

/**
 * Clase base abstracta para todos los Presets.
 * Maneja la inyección del Kernel y la carga de módulos desde modules.json.
 */
export abstract class BasePreset<T = any> implements IPreset<T> {
	/** Nombre único del preset */
	abstract readonly name: string;

	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);
	protected config: IModulesDefinition;

	constructor(protected readonly kernel: Kernel, protected readonly options?: any) {
		this.config = {};
	}

	/**
	 * Obtener la instancia del preset
	 */
	abstract getInstance(): T;

	/**
	 * Lógica de inicialización del preset
	 */
	public async start(): Promise<void> {
		const presetDir = this.getPresetDir();
		const modulesConfigPath = path.join(presetDir, "modules.json");

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

				// Fusionar presets (si es necesario en el futuro)
				if (optModules.presets) {
					mergedConfig.presets ??= [];
					for (const preset of optModules.presets) {
						const index = mergedConfig.presets.findIndex((p) => p.name === preset.name);
						if (index > -1) {
							mergedConfig.presets[index] = { ...mergedConfig.presets[index], ...preset };
						} else {
							mergedConfig.presets.push(preset);
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
	 * Lógica de cierre del preset
	 */
	public async stop(): Promise<void> {
		this.logger.logOk(`Detenido.`);
	}

	/**
	 * Resuelve el directorio del preset según el entorno
	 */
	protected getPresetDir(): string {
		const isDevelopment = process.env.NODE_ENV === "development";
		const presetName = this.constructor.name
			.replace(/Preset$/, "")
			.replaceAll(/([A-Z])/g, "-$1")
			.toLowerCase()
			.replace(/^-/, "");

		const presetDir = isDevelopment
			? path.resolve(process.cwd(), "src", "presets", presetName)
			: path.resolve(process.cwd(), "dist", "presets", presetName);

		return presetDir;
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
