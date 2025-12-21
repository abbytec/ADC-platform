import express, { Application, RequestHandler } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "node:http";
import { BaseProvider } from "../../BaseProvider.js";
import { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

/**
 * Implementación del servidor HTTP con Express
 */
export default class ExpressServerProvider extends BaseProvider implements IHttpServerProvider {
	public readonly name = "express-server";
	public readonly type = "http-server-provider";
	private app: Application;
	private server: Server | null = null;
	private isListening = false;

	constructor() {
		super();
		this.app = express();
		this.#setupMiddleware();
	}

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);
	}

	/**
	 * Configura el middleware común de Express
	 */
	#setupMiddleware(): void {
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

	async stop(kernelKey: symbol): Promise<void> {
		super.stop(kernelKey);
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
