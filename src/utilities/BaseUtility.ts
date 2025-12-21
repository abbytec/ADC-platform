import { IModule } from "../interfaces/modules/IModule.js";
import { ILogger } from "../interfaces/utils/ILogger.js";
import { Logger } from "../utils/logger/Logger.js";

export type IUtility = IModule;
export abstract class BaseUtility implements IUtility {
	abstract readonly name: string;
	protected readonly logger: ILogger = Logger.getLogger(this.constructor.name);

	public async stop(): Promise<void> {
		this.logger.logInfo(`Shutting down...`);
	}
}
