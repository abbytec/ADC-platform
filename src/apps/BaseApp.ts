import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IApp } from "../interfaces/modules/IApp.js";
import { Logger } from "../utils/Logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";
import { ILifecycle } from "../interfaces/behaviours/ILifecycle.js";

/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la carga de módulos desde archivos de configuración.
 */
export abstract class BaseApp implements IApp {
	public logger: ILogger = Logger.getLogger(this.constructor.name);

	constructor(protected readonly kernel: Kernel, public readonly name: string = this.constructor.name, public readonly config?: any) {}

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
	private async mergeModuleConfigs(): Promise<void> {
		const appDirName = this.name.split(":")[0];
		const isDevelopment = process.env.NODE_ENV === "development";
		const appDir = isDevelopment
			? path.resolve(process.cwd(), "src", "apps", appDirName)
			: path.resolve(process.cwd(), "dist", "apps", appDirName);

		let baseConfig: any = {};
		try {
			const defaultConfigPath = path.join(appDir, "default.json");
			const content = await fs.readFile(defaultConfigPath, "utf-8");
			baseConfig = JSON.parse(content);
		} catch (error) {
			// default.json might not exist, which is fine.
		}

		const instanceConfig = this.config || {};

		const mergedConfig: any = {
			...baseConfig,
			...instanceConfig,
			failOnError: instanceConfig.failOnError ?? baseConfig.failOnError,
			providers: [...(baseConfig.providers || []), ...(instanceConfig.providers || [])],
			middlewares: [...(baseConfig.middlewares || []), ...(instanceConfig.middlewares || [])],
			presets: [...(baseConfig.presets || []), ...(instanceConfig.presets || [])],
		};

		this.config = mergedConfig;
	}

	/**
	 * Carga los módulos de la app después de combinar las configuraciones.
	 */
	public async loadModulesFromConfig(): Promise<void> {
		try {
			await this.mergeModuleConfigs();
			if (this.config) {
				await Kernel.moduleLoader.loadAllModulesFromDefinition(this.config, this.kernel);
			}
		} catch (error) {
			this.logger.logError(`Error procesando la configuración de módulos: ${error}`);
			throw error;
		}
	}
}
