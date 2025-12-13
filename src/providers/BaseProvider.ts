import { IModule } from "../interfaces/modules/IModule.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/logger/Logger.js";

export interface IProvider<T> extends IModule {
	readonly type: string;
	getInstance(options?: any): Promise<T>;
}
export abstract class BaseProvider<T> implements IProvider<T> {
	abstract readonly name: string;
	abstract readonly type: string;
	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);

	abstract getInstance(options?: any): Promise<T>;

	public async stop(): Promise<void> {
		this.logger.logInfo(`Shutting down...`);
	}
}

export enum ProviderType {
	STORAGE_PROVIDER = "storage-provider",
	OBJECT_PROVIDER = "object-provider",
	QUEUE_PROVIDER = "queue-provider",
}
