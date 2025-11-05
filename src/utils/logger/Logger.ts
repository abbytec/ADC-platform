import { ILogger } from "../../interfaces/utils/ILogger.js";
import ConsoleLogger from "./ConsoleLogger.js";

const globalLogger: ILogger = new ConsoleLogger((process.env.LOG_LEVEL || "DEBUG") as "DEBUG" | "INFO" | "OK" | "WARN" | "ERROR" | "NONE");
/**
 * Clase Logger con métodos estáticos para logging global
 * Proporciona una interfaz simple sin necesidad de inyectar dependencias
 */
export class Logger {
	static debug(message: string, ...args: any[]): void {
		globalLogger.logDebug(message, ...args);
	}

	static info(message: string, ...args: any[]): void {
		globalLogger.logInfo(message, ...args);
	}

	static ok(message: string, ...args: any[]): void {
		globalLogger.logOk(message, ...args);
	}

	static warn(message: string, ...args: any[]): void {
		globalLogger.logWarn(message, ...args);
	}

	static error(message: string, ...args: any[]): void {
		globalLogger.logError(message, ...args);
	}

	static setLevel(level: "DEBUG" | "INFO" | "OK" | "WARN" | "ERROR" | "NONE"): void {
		globalLogger.setLevel(level);
	}

	static getLogger(title: string): ILogger {
		return globalLogger.getLogger(title);
	}
}
