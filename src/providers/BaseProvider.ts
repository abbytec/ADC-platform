import { IProvider } from "../interfaces/modules/IProvider.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/Logger/Logger.js";
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
	QUEUE_PROVIDER = "queue-provider",
}
