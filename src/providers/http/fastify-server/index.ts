import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyFormbody from "@fastify/formbody";
import * as path from "node:path";
import * as fs from "node:fs";
import { BaseProvider } from "../../BaseProvider.js";
import type { IHostBasedHttpProvider, HostOptions } from "../../../interfaces/modules/providers/IHttpServer.js";

interface RegisteredHost {
	pattern: string;
	regex: RegExp;
	directory: string;
	options: HostOptions;
	priority: number;
	routes: Map<string, Map<string, (req: FastifyRequest, reply: FastifyReply, params?: Record<string, string>) => void>>;
}

interface GlobalRoute {
	method: string;
	path: string;
	handler: (req: FastifyRequest, reply: FastifyReply, params?: Record<string, string>) => void;
}

interface PathMatchResult {
	matched: boolean;
	params: Record<string, string>;
}

/**
 * Convierte un patrón de host a regex
 * "*.local.com" -> /^(.+)\.local\.com$/
 * "cloud.local.com" -> /^cloud\.local\.com$/
 */
function hostPatternToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/\./g, "\\.").replace(/\*/g, "(.+)");
	return new RegExp(`^${escaped}$`, "i");
}

/**
 * Calcula la prioridad de un patrón de host
 * Patrones más específicos tienen mayor prioridad
 */
function calculatePriority(pattern: string, explicitPriority?: number): number {
	if (explicitPriority !== undefined) return explicitPriority;

	// Comodines tienen menor prioridad
	const wildcardCount = (pattern.match(/\*/g) || []).length;
	const parts = pattern.split(".");
	const specificity = parts.length * 10 - wildcardCount * 100;

	return specificity;
}

/**
 * Implementación del servidor HTTP con Fastify y soporte para host-based routing
 */
class FastifyServer implements IHostBasedHttpProvider {
	private app: FastifyInstance;
	private isListening = false;
	private registeredHosts = new Map<string, RegisteredHost>();
	private globalRoutes: GlobalRoute[] = [];
	private globalStaticPaths = new Map<string, string>();
	private defaultHost: RegisteredHost | null = null;

	constructor(private readonly logger: any) {
		this.app = Fastify({
			logger: false,
			routerOptions: {
				ignoreTrailingSlash: true,
			},
		});
		this.setupMiddleware();
	}

	private async setupMiddleware(): Promise<void> {
		// CORS
		await this.app.register(fastifyCors, {
			origin: true,
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
		});

		// Body parser para formularios
		await this.app.register(fastifyFormbody);

		// Log de peticiones en desarrollo
		if (process.env.NODE_ENV === "development") {
			this.app.addHook("onRequest", async (request) => {
				this.logger.logDebug(`${request.method} ${request.hostname}${request.url}`);
			});
		}

		// Hook principal para host-based routing
		this.app.addHook("preHandler", async (request, _reply) => {
			const hostname = this.extractHostname(request);
			const matchedHost = this.matchHost(hostname);

			if (matchedHost) {
				// Almacenar el host matcheado en la request para uso posterior
				(request as any).matchedHost = matchedHost;
			}
		});

		// Ruta catch-all para servir archivos estáticos por host
		this.app.get("/*", async (request, reply) => {
			await this.handleStaticRequest(request, reply);
		});

		// También manejar la raíz
		this.app.get("/", async (request, reply) => {
			await this.handleStaticRequest(request, reply);
		});
	}

	private extractHostname(request: FastifyRequest): string {
		const host = request.hostname || request.headers.host || "";
		// Eliminar puerto si existe
		return host.split(":")[0].toLowerCase();
	}

	private matchHost(hostname: string): RegisteredHost | null {
		// Ordenar hosts por prioridad (mayor primero)
		const sortedHosts = Array.from(this.registeredHosts.values()).sort((a, b) => b.priority - a.priority);

		for (const host of sortedHosts) {
			if (host.regex.test(hostname)) {
				return host;
			}
		}

		return this.defaultHost;
	}

	private async handleStaticRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
		const matchedHost = (request as any).matchedHost as RegisteredHost | undefined;
		let urlPath = request.url.split("?")[0];

		// Primero verificar rutas globales
		for (const route of this.globalRoutes) {
			if (route.method.toUpperCase() !== request.method) continue;

			const matchResult = this.matchPath(route.path, urlPath);
			if (matchResult.matched) {
				return route.handler(request, reply, matchResult.params);
			}
		}

		// Si no hay host matcheado, intentar con rutas estáticas globales
		if (!matchedHost) {
			// Buscar en rutas estáticas globales por prefijo de path
			for (const [pathPrefix, directory] of this.globalStaticPaths) {
				if (urlPath.startsWith(pathPrefix)) {
					const relativePath = urlPath.slice(pathPrefix.length) || "/index.html";
					const filePath = path.join(directory, relativePath);
					return this.serveFile(filePath, directory, reply);
				}
			}

			reply.code(404).send({ error: "Not Found", host: request.hostname });
			return;
		}

		// Verificar rutas específicas del host
		const hostRoutes = matchedHost.routes.get(request.method.toUpperCase());
		if (hostRoutes) {
			for (const [routePath, handler] of hostRoutes) {
				const matchResult = this.matchPath(routePath, urlPath);
				if (matchResult.matched) {
					return handler(request, reply, matchResult.params);
				}
			}
		}

		// Servir archivos estáticos del host
		if (urlPath === "/" || urlPath === "") {
			urlPath = "/index.html";
		}

		const filePath = path.join(matchedHost.directory, urlPath);
		await this.serveFile(filePath, matchedHost.directory, reply, matchedHost.options);
	}

	private matchPath(pattern: string, urlPath: string): PathMatchResult {
		// Extraer nombres de parámetros del patrón
		const paramNames: string[] = [];
		const regexPattern = pattern
			.replace(/:([^/]+)/g, (_match, paramName) => {
				paramNames.push(paramName);
				return "([^/]+)";
			})
			.replace(/\*/g, ".*");

		const regex = new RegExp(`^${regexPattern}$`);
		const match = urlPath.match(regex);

		if (!match) {
			return { matched: false, params: {} };
		}

		// Extraer valores de parámetros
		const params: Record<string, string> = {};
		paramNames.forEach((name, index) => {
			params[name] = match[index + 1];
		});

		return { matched: true, params };
	}

	private async serveFile(filePath: string, baseDir: string, reply: FastifyReply, options?: HostOptions): Promise<void> {
		try {
			// Verificar que el archivo existe
			if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
				const ext = path.extname(filePath).toLowerCase();
				const contentType = this.getContentType(ext);

				// Headers adicionales si están configurados
				if (options?.headers) {
					for (const [key, value] of Object.entries(options.headers)) {
						reply.header(key, value);
					}
				}

				reply.header("Content-Type", contentType);
				const content = fs.readFileSync(filePath);
				reply.send(content);
				return;
			}

			// SPA fallback: si el archivo no existe y está habilitado, servir index.html
			if (options?.spaFallback) {
				const indexPath = path.join(baseDir, "index.html");
				if (fs.existsSync(indexPath)) {
					reply.header("Content-Type", "text/html");
					const content = fs.readFileSync(indexPath);
					reply.send(content);
					return;
				}
			}

			reply.code(404).send({ error: "File not found" });
		} catch (error: any) {
			this.logger.logError(`Error serving file ${filePath}: ${error.message}`);
			reply.code(500).send({ error: "Internal server error" });
		}
	}

	private getContentType(ext: string): string {
		const types: Record<string, string> = {
			".html": "text/html; charset=utf-8",
			".js": "application/javascript; charset=utf-8",
			".mjs": "application/javascript; charset=utf-8",
			".css": "text/css; charset=utf-8",
			".json": "application/json; charset=utf-8",
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".svg": "image/svg+xml",
			".ico": "image/x-icon",
			".woff": "font/woff",
			".woff2": "font/woff2",
			".ttf": "font/ttf",
			".eot": "application/vnd.ms-fontobject",
			".map": "application/json",
		};
		return types[ext] || "application/octet-stream";
	}

	async getInstance(): Promise<IHostBasedHttpProvider> {
		return this;
	}

	/** Obtener la instancia raw de Fastify (para casos especiales) */
	getApp(): FastifyInstance {
		return this.app;
	}

	registerRoute(method: string, path: string, handler: any): void {
		const adaptedHandler = this.adaptHandler(handler);

		this.globalRoutes.push({
			method: method.toUpperCase(),
			path,
			handler: adaptedHandler,
		});

		this.logger.logDebug(`Ruta global registrada: ${method.toUpperCase()} ${path}`);
	}

	serveStatic(urlPath: string, directory: string): void {
		this.globalStaticPaths.set(urlPath, directory);
		this.logger.logDebug(`Archivos estáticos globales: ${urlPath} -> ${directory}`);
	}

	registerHost(hostPattern: string, directory: string, options: HostOptions = {}): void {
		const priority = calculatePriority(hostPattern, options.priority);
		const regex = hostPatternToRegex(hostPattern);

		const host: RegisteredHost = {
			pattern: hostPattern,
			regex,
			directory,
			options: {
				spaFallback: true,
				...options,
			},
			priority,
			routes: new Map(),
		};

		this.registeredHosts.set(hostPattern, host);

		// Si es un comodín genérico, usarlo como default
		if (hostPattern === "*" || hostPattern === "*.*") {
			this.defaultHost = host;
		}

		this.logger.logDebug(`Host registrado: ${hostPattern} -> ${directory} (priority: ${priority})`);
	}

	registerHostRoute(hostPattern: string, method: string, path: string, handler: any): void {
		let host = this.registeredHosts.get(hostPattern);

		if (!host) {
			// Crear host sin directorio si no existe
			this.registerHost(hostPattern, "", { spaFallback: false });
			host = this.registeredHosts.get(hostPattern)!;
		}

		const methodUpper = method.toUpperCase();
		if (!host.routes.has(methodUpper)) {
			host.routes.set(methodUpper, new Map());
		}

		host.routes.get(methodUpper)!.set(path, this.adaptHandler(handler));
		this.logger.logDebug(`Ruta de host registrada: ${hostPattern} ${methodUpper} ${path}`);
	}

	getRegisteredHosts(): string[] {
		return Array.from(this.registeredHosts.keys());
	}

	supportsHostRouting(): boolean {
		return true;
	}

	/**
	 * Adapta un handler de Express a Fastify con soporte para params extraídos
	 */
	private adaptHandler(handler: any): (req: FastifyRequest, reply: FastifyReply, params?: Record<string, string>) => void {
		return async (req: FastifyRequest, reply: FastifyReply, extractedParams?: Record<string, string>) => {
			// Crear objetos compatibles con Express
			// Combinar params de Fastify con los extraídos manualmente
			const combinedParams = { ...(req.params as object), ...extractedParams };

			const expressReq = {
				...req,
				params: combinedParams,
				query: req.query,
				body: req.body,
				path: req.url,
				method: req.method,
				headers: req.headers,
				get: (header: string) => req.headers[header.toLowerCase()],
			};

			// Track content-type para aplicarlo antes de send
			let pendingContentType: string | null = null;

			const expressRes = {
				status: (code: number) => {
					reply.code(code);
					return expressRes;
				},
				code: (code: number) => {
					reply.code(code);
					return expressRes;
				},
				json: (data: any) => reply.send(data),
				send: (data: any) => {
					// Aplicar content-type antes de enviar para evitar que Fastify lo infiera
					if (pendingContentType) {
						reply.type(pendingContentType);
					}
					return reply.send(data);
				},
				redirect: (url: string) => reply.redirect(url),
				setHeader: (key: string, value: string) => {
					// Capturar Content-Type para aplicarlo antes de send
					if (key.toLowerCase() === "content-type") {
						pendingContentType = value;
					}
					reply.header(key, value);
					return expressRes;
				},
				header: (key: string, value: string) => {
					if (key.toLowerCase() === "content-type") {
						pendingContentType = value;
					}
					reply.header(key, value);
					return expressRes;
				},
				type: (contentType: string) => {
					pendingContentType = contentType;
					reply.type(contentType);
					return expressRes;
				},
			};

			try {
				await handler(expressReq, expressRes);
			} catch (error: any) {
				this.logger.logError(`Error en handler: ${error.message}`);
				if (!reply.sent) {
					reply.code(500).send({ error: error.message });
				}
			}
		};
	}

	async listen(port: number): Promise<void> {
		if (this.isListening) {
			this.logger.logWarn("El servidor ya está escuchando");
			return;
		}

		try {
			await this.app.listen({ port, host: "0.0.0.0" });
			this.isListening = true;
			this.logger.logOk(`Servidor Fastify escuchando en puerto ${port}`);

			if (this.registeredHosts.size > 0) {
				this.logger.logInfo(`Hosts virtuales registrados: ${this.registeredHosts.size}`);
				for (const [pattern] of this.registeredHosts) {
					this.logger.logDebug(`  - ${pattern}`);
				}
			}
		} catch (error: any) {
			if (error.code === "EADDRINUSE") {
				this.logger.logError(`Puerto ${port} ya está en uso`);
			} else {
				this.logger.logError(`Error en el servidor: ${error.message}`);
			}
			throw error;
		}
	}

	async stop(): Promise<void> {
		if (this.isListening) {
			try {
				await this.app.close();
				this.isListening = false;
				this.logger.logOk("Servidor Fastify detenido");
			} catch (error: any) {
				this.logger.logError(`Error cerrando servidor: ${error.message}`);
				throw error;
			}
		}
	}
}

/**
 * Provider que expone el servidor Fastify con soporte para host-based routing
 */
export default class FastifyServerProvider extends BaseProvider<IHostBasedHttpProvider> {
	public readonly name = "fastify-server";
	public readonly type = "http-server-provider";

	private fastifyServer: FastifyServer | null = null;

	async getInstance(_options?: any): Promise<IHostBasedHttpProvider> {
		this.fastifyServer ??= new FastifyServer(this.logger);
		return this.fastifyServer;
	}

	async stop(): Promise<void> {
		if (this.fastifyServer) {
			await this.fastifyServer.stop();
		}
		await super.stop();
	}
}
