import { IUtility } from "../interfaces/modules/IUtility.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/logger/Logger.js";

export abstract class BaseUtility<T> implements IUtility<T> {
	abstract readonly name: string;
	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);

	abstract getInstance(options?: any): Promise<T>;

	public async stop(): Promise<void> {
		this.logger.logInfo(`Shutting down...`);
	}
}
