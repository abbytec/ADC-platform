import express, { Application, RequestHandler } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "node:http";
import { BaseProvider } from "../../BaseProvider.js";
import { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

/**
 * Implementación del servidor HTTP con Express
 */
class ExpressServer implements IHttpServerProvider {
	private app: Application;
	private server: Server | null = null;
	private isListening = false;

	constructor(private readonly logger: any) {
		this.app = express();
		this.setupMiddleware();
	}

	/**
	 * Configura el middleware común de Express
	 */
	private setupMiddleware(): void {
		// CORS para permitir peticiones cross-origin
		this.app.use(cors());

		// Body parser para JSON y URL encoded
		this.app.use(bodyParser.json());
		this.app.use(bodyParser.urlencoded({ extended: true }));

		// Log de peticiones en desarrollo
		if (process.env.NODE_ENV === "development") {
			this.app.use((req: any, _res: any, next: any) => {
				this.logger.logDebug(`${req.method} ${req.path}`);
				next();
			});
		}
	}

	async getInstance(): Promise<Application> {
		return this.app;
	}

	registerRoute(method: string, path: string, handler: RequestHandler): void {
		const methodLower = method.toLowerCase() as keyof Application;
		if (typeof this.app[methodLower] === "function") {
			(this.app[methodLower] as any)(path, handler);
			this.logger.logDebug(`Ruta registrada: ${method.toUpperCase()} ${path}`);
		} else {
			this.logger.logError(`Método HTTP inválido: ${method}`);
		}
	}

	serveStatic(path: string, directory: string): void {
		this.app.use(path, express.static(directory));
		this.logger.logDebug(`Archivos estáticos servidos: ${path} -> ${directory}`);
	}

	async listen(port: number): Promise<void> {
		if (this.isListening) {
			this.logger.logWarn("El servidor ya está escuchando");
			return;
		}

		return new Promise((resolve, reject) => {
			try {
				this.server = this.app.listen(port, () => {
					this.isListening = true;
					this.logger.logOk(`Servidor HTTP escuchando en puerto ${port}`);
					resolve();
				});

				this.server?.on("error", (error: any) => {
					if (error.code === "EADDRINUSE") {
						this.logger.logError(`Puerto ${port} ya está en uso`);
					} else {
						this.logger.logError(`Error en el servidor: ${error.message}`);
					}
					reject(error);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	async stop(): Promise<void> {
		if (this.server && this.isListening) {
			return new Promise((resolve, reject) => {
				this.server!.close((err) => {
					if (err) {
						this.logger.logError(`Error cerrando servidor: ${err}`);
						reject(err);
					} else {
						this.isListening = false;
						this.logger.logOk("Servidor HTTP detenido");
						resolve();
					}
				});
			});
		}
	}
}

/**
 * Provider que expone el servidor Express
 */
export default class HttpServerProvider extends BaseProvider<IHttpServerProvider> {
	public readonly name = "express-server";
	public readonly type = "http-server-provider";

	private expressServer: ExpressServer | null = null;

	async getInstance(_options?: any): Promise<IHttpServerProvider> {
		this.expressServer ??= new ExpressServer(this.logger);
		return this.expressServer;
	}

	async stop(): Promise<void> {
		if (this.expressServer) {
			await this.expressServer.stop();
		}
		await super.stop();
	}
}
