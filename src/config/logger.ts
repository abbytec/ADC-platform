import ConsoleLogger from '../utils/ConsoleLogger.js';
import { ILogger } from '../interfaces/ILogger.js';

// Instancia global del logger
export const globalLogger: ILogger = new ConsoleLogger(
  (process.env.LOG_LEVEL || 'DEBUG') as 'DEBUG' | 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'NONE'
);
