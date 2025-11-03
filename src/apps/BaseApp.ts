import * as path from "node:path";
import { IApp } from "../interfaces/modules/IApp.js";
import { Logger } from "../utils/Logger/Logger.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Kernel } from "../kernel.js";
import { ILifecycle } from "../interfaces/behaviours/ILifecycle.js";

/**
 * Clase base abstracta para todas las Apps.
 * Maneja la inyección del Kernel y la carga de módulos desde modules.json.
 */
export abstract class BaseApp implements IApp {
	protected logger: ILogger = Logger.getLogger(this.constructor.name);

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
	 * Carga módulos desde modules.json en el mismo directorio de la app
	 */
	public async loadModulesFromConfig(): Promise<void> {
		try {
			const isDevelopment = process.env.NODE_ENV === "development";
			const appDir = isDevelopment
				? path.resolve(process.cwd(), "src", "apps", this.name.split(":")[0])
				: path.resolve(process.cwd(), "dist", "apps", this.name.split(":")[0]);

			const modulesConfigPath = path.join(appDir, "modules.json");
			await Kernel.moduleLoader.loadAllModulesFromConfig(modulesConfigPath, this.kernel);

			if (this.config?.modules) {
				await Kernel.moduleLoader.loadAllModulesFromDefinition(this.config.modules, this.kernel);
			}
		} catch (error) {
			this.logger.logError(`Error procesando modules.json: ${error}`);
			throw error;
		}
	}
}
