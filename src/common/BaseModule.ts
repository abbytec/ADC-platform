import { IModule, IModuleConfig } from "../interfaces/modules/IModule.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/logger/Logger.js";
import { Kernel } from "../kernel.js";

/**
 * Clase base abstracta para módulos que necesitan acceso al Kernel.
 * Proporciona métodos protegidos para obtener providers, services y utilities
 * de forma controlada (solo los declarados en la configuración del módulo).
 *
 * Extendida por: BaseApp, BaseService, BaseUtility
 * NO extendida por: BaseProvider (no necesita acceso al registry)
 */
export abstract class BaseModule implements IModule {
	abstract readonly name: string;

	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);
	protected config: IModuleConfig;
	#kernel: Kernel;

	constructor(kernel: Kernel, config?: IModuleConfig) {
		this.#kernel = kernel;
		this.config = {
			name: "unknown",
			...config,
		} as IModuleConfig;
	}

	/**
	 * Lógica de inicialización del módulo.
	 */
	public abstract start(_kernelKey: symbol): Promise<void>;

	/**
	 * Lógica de detención del módulo.
	 */
	public abstract stop(_kernelKey?: symbol): Promise<void>;

	/**
	 * Obtiene un provider que fue cargado por este módulo según su configuración.
	 * Esto asegura que se obtiene la instancia correcta cuando hay múltiples providers del mismo tipo.
	 * @param name - Nombre del provider
	 * @param config - Configuración opcional para sobrescribir la búsqueda
	 * @returns La instancia del provider
	 */
	protected getMyProvider<P>(name: string, config?: IModuleConfig): P {
		const providerConfig = config || this.config?.providers?.find((p) => p.name === name);
		if (!providerConfig) {
			throw new Error(`Provider ${name} no está configurado en ${this.name}`);
		}
		return this.#kernel.registry.getProvider<P>(name, providerConfig.custom);
	}

	/**
	 * Obtiene una utility que fue cargada por este módulo según su configuración.
	 * @param name - Nombre de la utility
	 * @param config - Configuración opcional para sobrescribir la búsqueda
	 * @returns La instancia de la utility
	 */
	protected getMyUtility<U>(name: string, config?: IModuleConfig): U {
		const utilityConfig = config || this.config?.utilities?.find((u) => u.name === name);
		if (!utilityConfig) {
			throw new Error(`Utility ${name} no está configurada en ${this.name}`);
		}
		return this.#kernel.registry.getUtility<U>(name, utilityConfig.custom);
	}

	/**
	 * Obtiene un service que fue cargado por este módulo según su configuración.
	 * @param name - Nombre del service
	 * @param config - Configuración opcional para sobrescribir la búsqueda
	 * @returns La instancia del service
	 */
	protected getMyService<S>(name: string, config?: IModuleConfig): S {
		const serviceConfig = config || this.config?.services?.find((s: any) => s.name === name);
		if (!serviceConfig) {
			throw new Error(`Service ${name} no está configurado en ${this.name}`);
		}
		return this.#kernel.registry.getService<S>(name, serviceConfig.custom);
	}
}
