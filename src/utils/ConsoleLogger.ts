import { ILogger } from '../interfaces/ILogger.js';

type LogLevel = 'DEBUG' | 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'NONE';

const LogLevelValues: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  OK: 2,
  WARN: 3,
  ERROR: 4,
  NONE: 5,
};

/**
 * Códigos ANSI para colores en la consola
 */
const Colors = {
  Reset: '\x1b[0m',
  Debug: '\x1b[36m',    // Cyan
  Info: '\x1b[34m',     // Blue
  Ok: '\x1b[32m',       // Green
  Warn: '\x1b[33m',     // Yellow
  Error: '\x1b[31m',    // Red
  Dim: '\x1b[2m',       // Dim
};

/**
 * Implementación de logger en consola con soporte para colores y niveles
 */
export default class ConsoleLogger implements ILogger {
  private currentLevel: LogLevel;

  constructor(initialLevel: LogLevel = 'DEBUG') {
    this.currentLevel = initialLevel;
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LogLevelValues[level] >= LogLevelValues[this.currentLevel];
  }

  private format(level: LogLevel, message: string): string {
    const levelLabel = level.padEnd(5);
    const timestamp = new Date().toLocaleTimeString('es-ES');
    
    switch (level) {
      case 'DEBUG':
        return `${Colors.Dim}${timestamp}${Colors.Reset} ${Colors.Debug}[${levelLabel}]${Colors.Reset} ${message}`;
      case 'INFO':
        return `${timestamp} ${Colors.Info}[${levelLabel}]${Colors.Reset} ${message}`;
      case 'OK':
        return `${timestamp} ${Colors.Ok}[${levelLabel}]${Colors.Reset} ${message}`;
      case 'WARN':
        return `${timestamp} ${Colors.Warn}[${levelLabel}]${Colors.Reset} ${message}`;
      case 'ERROR':
        return `${timestamp} ${Colors.Error}[${levelLabel}]${Colors.Reset} ${message}`;
      default:
        return message;
    }
  }

  public logDebug(message: string, ...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log(this.format('DEBUG', message), ...args);
    }
  }

  public logInfo(message: string, ...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.log(this.format('INFO', message), ...args);
    }
  }

  public logOk(message: string, ...args: any[]): void {
    if (this.shouldLog('OK')) {
      console.log(this.format('OK', message), ...args);
    }
  }

  public logWarn(message: string, ...args: any[]): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.format('WARN', message), ...args);
    }
  }

  public logError(message: string, ...args: any[]): void {
    if (this.shouldLog('ERROR')) {
      console.error(this.format('ERROR', message), ...args);
    }
  }
}
