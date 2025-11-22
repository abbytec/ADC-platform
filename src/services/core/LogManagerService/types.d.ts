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

export interface ILogManagerService {
    queryLogs(appName: string, date?: string): Promise<string>;
    cleanupLogs(): Promise<void>;
    getLogsDir(): string;
}

