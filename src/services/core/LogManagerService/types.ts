export interface LogManagerConfig {
    retentionDays: number;
    retentionCount?: number;
    logsDir: string;
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

/**
 * HTTP Request Log Document
 * Registra información de requests HTTP con status basado en tipo de error
 */
export interface HttpLogEntry {
    endpoint: string;        // ej: "/api/users/profile"
    method: string;          // GET, POST, PUT, PATCH, DELETE
    status: "success" | "refused" | "failed";  // success: POST/PUT/PATCH/DELETE sin error | refused: HttpError o AuthError | failed: otro error
    statusCode: number;      
    message: string;         
    timestamp: Date;         
}

/**
 * Parámetros para logHttpRequest
 */
export interface HttpRequestLog {
    endpoint: string;
    method: string;
    statusCode: number;
    error?: Error;
}

export interface ILogManagerService {
    queryLogs(appName: string, date?: string): Promise<string>;
    cleanupLogs(): Promise<void>;
    getLogsDir(): string;
    logHttpRequest(request: HttpRequestLog): Promise<void>;
    /**
     * Obtiene estadísticas de logs HTTP
     */
    getHttpLogStats(): Promise<{ total: number; byStatus: Record<string, number>; byEndpoint: Record<string, number> }>;
}

