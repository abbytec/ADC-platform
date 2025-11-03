import * as path from "node:path";
import { IPreset } from "../interfaces/IPreset.js";
import { IKernel } from "../interfaces/IKernel.js";
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

	protected logger: ILogger = Logger.getLogger(this.constructor.name);

	constructor(protected readonly kernel: IKernel) {}

	/**
	 * Obtener la instancia del preset
	 */
	abstract getInstance(): T;

	/**
	 * Lógica de inicialización del preset
	 */
	public async initialize(): Promise<void> {
		const presetDir = this.getPresetDir();
		const modulesConfigPath = path.join(presetDir, "modules.json");

		this.logger.logDebug(`Inicializando y cargando módulos...`);

		try {
			await Kernel.moduleLoader.loadAllModulesFromConfig(modulesConfigPath, this.kernel);
			await this.onInitialize();
			this.logger.logOk(`Inicialización completada`);
		} catch (error) {
			this.logger.logError(`Error durante inicialización: ${error}`);
			throw error;
		}
	}

	/**
	 * Hook para que subclases implementen lógica adicional después de cargar módulos
	 * Implementar en subclases si es necesario
	 */
	protected async onInitialize(): Promise<void> {
		/* noop */
	}

	/**
	 * Lógica de cierre del preset
	 */
	public async shutdown(): Promise<void> {
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
	protected getProvider<P>(name: string): P {
		return this.kernel.getProvider<P>(name);
	}

	/**
	 * Obtener el middleware del kernel
	 */
	protected getMiddleware<M>(name: string): M {
		return this.kernel.getMiddleware<M>(name);
	}
}
