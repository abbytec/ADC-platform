import { IModule } from "../interfaces/modules/IModule.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { OnlyKernel } from "../utils/decorators/OnlyKernel.ts";
import { Logger } from "../utils/logger/Logger.js";

export interface IProvider extends IModule {
	readonly type: string;
}
export abstract class BaseProvider implements IProvider {
	private kernelKey?: symbol;
	/** Nombre único del provider */
	abstract readonly name: string;
	abstract readonly type: string;
	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);

	public readonly setKernelKey = (key: symbol): void => {
		if (this.kernelKey) {
			throw new Error("Kernel key ya está establecida");
		}
		this.kernelKey = key;
	};

	@OnlyKernel()
	public async start(_kernelKey: symbol): Promise<void> {
		this.logger.logDebug(`Iniciando ${this.name}`);
	}

	@OnlyKernel()
	public async stop(_kernelKey: symbol): Promise<void> {
		this.logger.logDebug(`Deteniendo ${this.name}`);
	}
}

export enum ProviderType {
	STORAGE_PROVIDER = "storage-provider",
	OBJECT_PROVIDER = "object-provider",
	QUEUE_PROVIDER = "queue-provider",
}
