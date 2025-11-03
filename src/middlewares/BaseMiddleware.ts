import { IMiddleware } from "../interfaces/modules/IMiddleware.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/Logger/Logger.js";

export abstract class BaseMiddleware<T> implements IMiddleware<T> {
	abstract name: string;
	protected logger: ILogger = Logger.getLogger(this.constructor.name);

	abstract getInstance(options?: any): Promise<T> | T;

	public async shutdown(): Promise<void> {
		this.logger.logInfo(`Shutting down...`);
	}
}
