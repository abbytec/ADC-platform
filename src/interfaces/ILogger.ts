/**
 * Interfaz para el sistema de logging
 */
export interface ILogger {
  logDebug(message: string, ...args: any[]): void;
  logInfo(message: string, ...args: any[]): void;
  logOk(message: string, ...args: any[]): void;
  logWarn(message: string, ...args: any[]): void;
  logError(message: string, ...args: any[]): void;
  setLevel(level: 'DEBUG' | 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'NONE'): void;
}
