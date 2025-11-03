import { IProvider } from "../interfaces/modules/IProvider.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/Logger/Logger.js";

export abstract class BaseProvider<T> implements IProvider<T> {
	abstract name: string;
	abstract type: string;
	protected logger: ILogger = Logger.getLogger(this.constructor.name);

	abstract getInstance(options?: any): Promise<T> | T;

	public async shutdown(): Promise<void> {
		this.logger.logInfo(`Shutting down...`);
	}
}
