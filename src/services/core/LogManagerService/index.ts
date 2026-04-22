import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type Model, Schema } from "mongoose";
import { BaseService } from "../../BaseService.js";
import { Kernel } from "../../../kernel.js";
import { ILogManagerService, type HttpLogEntry, type HttpRequestLog } from "./types.js";
import { ModuleTypes } from "../../../utils/registry/ModuleRegistry.js";
import type { IMongoProvider } from "../../../providers/object/mongo/index.js";
import { AuthError } from "@common/types/custom-errors/AuthError.js";
import { HttpError } from "@common/types/ADCCustomError.js";

export default class LogManagerService extends BaseService implements ILogManagerService {
	public readonly name = "LogManagerService";
	private cleanupInterval: NodeJS.Timeout | null = null;
	#mongo: IMongoProvider | null = null;
	#httpLogModel: Model<HttpLogEntry> | null = null;

	constructor(kernel: Kernel, options?: any) {
		super(kernel, options);
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		// Ensure logs directory exists
		const logsDir = this.getLogsDir();
		try {
			await fs.mkdir(logsDir, { recursive: true });
		} catch (error: any) {
			this.logger.logError(`Could not create logs directory: ${error.message}`);
		}

		// Initialize MongoDB connection and HTTP log model
		try {
			this.#mongo = this.getMyProvider<IMongoProvider>("object/mongo");
			await this.#mongo.connect();

			// Create HTTP log schema with indexes
			const httpLogSchema = new Schema<HttpLogEntry>(
				{
					endpoint: { type: String, required: true, index: true },
					method: { type: String, required: true },
					status: { type: String, enum: ["success", "refused", "failed"], required: true, index: true },
					statusCode: { type: Number, required: true },
					message: { type: String, required: true },
					timestamp: { type: Date, default: Date.now, index: true },
				},
				{ collection: "http_logs" }
			);

			// Add compound index for queries
			httpLogSchema.index({ endpoint: 1, status: 1, timestamp: -1 });

			this.#httpLogModel = this.#mongo.createModel<HttpLogEntry>("HttpLog", httpLogSchema);
			this.logger.logOk("HTTP logging initialized with MongoDB");
		} catch (error: any) {
			this.logger.logError(`Failed to initialize HTTP logging: ${error.message}`);
			// Service continues to work with file-based logs
		}

		// Run cleanup on start
		await this.cleanupLogs();

		// Schedule daily cleanup
		this.cleanupInterval = setInterval(
			() => {
				this.cleanupLogs();
			},
			24 * 60 * 60 * 1000
		);

		this.logger.logOk("LogManagerService started");
	}

	async stop(kernelKey: symbol): Promise<void> {
		await super.stop(kernelKey);
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.#mongo = null;
		this.#httpLogModel = null;
	}

	getLogsDir(moduleType?: ModuleTypes): string {
		const configDir = this.config.custom?.logsDir || "temp/logs";
		if (!moduleType) return path.resolve(process.cwd(), configDir);
		return path.resolve(process.cwd(), moduleType, configDir);
	}

	/**
	 * Log an HTTP request
	 * - Silently fails if MongoDB is unavailable
	 * - Async non-blocking operation
	 */
	async logHttpRequest(request: HttpRequestLog): Promise<void> {
		if (!this.#httpLogModel) {
			return; // MongoDB not available
		}

		try {
			const { endpoint, method, statusCode, error } = request;

			// Skip logging GET requests without error
			if (!error && method === "GET") {
				return;
			}

			// Determine status based on error type
			let status: "success" | "refused" | "failed";
			let message = "";

			if (!error) {
				// Success only for mutative operations without error
				status = "success";
				message = "Request successful";
			} else {
				// Check error type: AuthError or HttpError are "refused", others are "failed"
				if (error instanceof AuthError || error instanceof HttpError) {
					status = "refused";
				} else {
					status = "failed";
				}

				// Limit message length to 500 chars
				message = error.message.slice(0, 500);
			}

			// Create and save log entry (non-blocking)
			const logEntry: HttpLogEntry = {
				endpoint,
				method,
				status,
				statusCode,
				message,
				timestamp: new Date(),
			};

			// Fire and forget - don't await to avoid blocking response
			this.#httpLogModel
				.create(logEntry)
				.catch((err: any) => {
					this.logger.logDebug(`Failed to save HTTP log: ${err.message}`);
				});
		} catch (error: any) {
			this.logger.logDebug(`Error in logHttpRequest: ${error.message}`);
		}
	}

	/**
	 * Get HTTP log statistics
	 */
	async getHttpLogStats(): Promise<{ total: number; byStatus: Record<string, number>; byEndpoint: Record<string, number> }> {
		if (!this.#httpLogModel) {
			return { total: 0, byStatus: {}, byEndpoint: {} };
		}

		try {
			const total = await this.#httpLogModel.countDocuments();

			const byStatusDocs = await this.#httpLogModel.aggregate([
				{ $group: { _id: "$status", count: { $sum: 1 } } },
			]);
			const byStatus: Record<string, number> = {};
			byStatusDocs.forEach((doc: any) => {
				byStatus[doc._id] = doc.count;
			});

			const byEndpointDocs = await this.#httpLogModel.aggregate([
				{ $group: { _id: "$endpoint", count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 20 },
			]);
			const byEndpoint: Record<string, number> = {};
			byEndpointDocs.forEach((doc: any) => {
				byEndpoint[doc._id] = doc.count;
			});

			return { total, byStatus, byEndpoint };
		} catch (error: any) {
			this.logger.logError(`Error getting HTTP log stats: ${error.message}`);
			return { total: 0, byStatus: {}, byEndpoint: {} };
		}
	}

	/**
	 * Delete logs older than the configured retention days or count
	 */
	async cleanupLogs(): Promise<void> {
		const retentionDays = this.config.custom?.retentionDays || 3;
		const retentionCount = this.config.custom?.retentionCount || 10;
		const logsDir = this.getLogsDir();
		const now = Date.now();
		const maxAge = retentionDays * 24 * 60 * 60 * 1000;

		this.logger.logInfo(`Cleaning up logs (older than ${retentionDays} days or > ${retentionCount} files) in ${logsDir}`);

		try {
			await this.#processDirectoryForCleanup(logsDir, now, maxAge, retentionCount);
		} catch (error: any) {
			this.logger.logError(`Error during log cleanup: ${error.message}`);
		}

		// Cleanup old HTTP logs from MongoDB
		if (this.#httpLogModel) {
			try {
				const cutoffDate = new Date(Date.now() - maxAge);
				const result = await this.#httpLogModel.deleteMany({ timestamp: { $lt: cutoffDate } });
				if (result.deletedCount > 0) {
					this.logger.logDebug(`Cleaned up ${result.deletedCount} old HTTP logs from MongoDB`);
				}
			} catch (error: any) {
				this.logger.logError(`Error cleaning HTTP logs from MongoDB: ${error.message}`);
			}
		}
	}

	async #processDirectoryForCleanup(dir: string, now: number, maxAge: number, retentionCount: number) {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			// Separate files and directories
			const files: { name: string; path: string; time: number }[] = [];

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					// Recursive call for subdirectories
					await this.#processDirectoryForCleanup(fullPath, now, maxAge, retentionCount);

					// Try to remove empty directories
					try {
						const remaining = await fs.readdir(fullPath);
						if (remaining.length === 0) {
							await fs.rmdir(fullPath);
						}
					} catch {
						// ignore
					}
				} else {
					// Collect file stats
					const stats = await fs.stat(fullPath);
					files.push({
						name: entry.name,
						path: fullPath,
						time: stats.mtimeMs,
					});
				}
			}

			// 1. Filter by Age
			const remainingFiles: typeof files = [];
			for (const file of files) {
				if (now - file.time > maxAge) {
					await fs.unlink(file.path);
					this.logger.logDebug(`Deleted old log file (age): ${file.name}`);
				} else {
					remainingFiles.push(file);
				}
			}

			// 2. Filter by Count (keep newest)
			if (remainingFiles.length > retentionCount) {
				// Sort by time descending (newest first)
				remainingFiles.sort((a, b) => b.time - a.time);

				const filesToDelete = remainingFiles.slice(retentionCount);
				for (const file of filesToDelete) {
					await fs.unlink(file.path);
					this.logger.logDebug(`Deleted old log file (count limit): ${file.name}`);
				}
			}
		} catch (error) {
			// Directory might not exist yet or access denied
		}
	}

	/**
	 * Query logs for a specific app
	 */
	async queryLogs(title: string, moduleType: ModuleTypes, date?: string): Promise<string> {
		const logsDir = this.getLogsDir();
		const moduleLogDir = path.join(logsDir, moduleType, title);

		try {
			// Check if directory exists
			try {
				await fs.access(moduleLogDir);
			} catch {
				// Check for flat file
				const flatFile = path.join(logsDir, `${title}.log`);
				try {
					return await fs.readFile(flatFile, "utf-8");
				} catch {
					return `No logs found for ${title}`;
				}
			}

			// If directory, read files
			const files = await fs.readdir(moduleLogDir);
			let content = "";

			for (const file of files) {
				if (date && !file.includes(date)) continue;

				content += `--- Log File: ${file} ---\n`;
				content += await fs.readFile(path.join(moduleLogDir, file), "utf-8");
				content += "\n";
			}

			return content || "No matching logs found.";
		} catch (error: any) {
			return `Error querying logs: ${error.message}`;
		}
	}
}
