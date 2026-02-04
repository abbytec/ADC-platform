import { BaseService } from "../../BaseService.js";
import type { IHostBasedHttpProvider, FastifyRequest, FastifyReply } from "../../../interfaces/modules/providers/IHttpServer.js";
import {
	UncommonResponse,
	type RegisteredEndpoint,
	type EndpointCtx,
	type AuthenticatedUserInfo,
	type HttpMethod,
	type EndpointConfig,
	type ServiceCallRequest,
	type ServiceCallResponse,
	type EndpointHandler,
} from "./types.js";
import ADCCustomError from "@common/types/ADCCustomError.js";
import { setPermissionValidator } from "./decorators.js";
import SessionManagerService from "../../security/SessionManagerService/index.ts";
// Re-exportar decoradores para uso externo
export { RegisterEndpoint, EnableEndpoints, DisableEndpoints, readEndpointMetadata, readEnableEndpointsConfig } from "./decorators.js";

// Re-exportar tipos, HttpError y UncommonResponse
export {
	UncommonResponse,
	type EndpointConfig,
	type EndpointCtx,
	type EndpointHandler,
	type HttpMethod,
	type RegisteredEndpoint,
	type AuthenticatedUserInfo,
	type EnableEndpointsConfig,
	type CookieOptions,
	type SetCookie,
	type ClearCookie,
} from "./types.js";

/**
 * EndpointManagerService - Gestión centralizada de endpoints HTTP
 *
 * **Características:**
 * - Registro declarativo de endpoints via @RegisterEndpoint
 * - Validación automática de permisos via SessionManagerService
 * - Comunicación inter-servicios con validación de permisos
 * - Soporte para managers anidados via @EnableEndpoints
 *
 * **kernelMode: 0** - No es un servicio de kernel, se carga bajo demanda
 *
 * @example
 * ```typescript
 * // En un servicio
 * class MyService extends BaseService {
 *   @RegisterEndpoint({
 *     method: "GET",
 *     url: "/api/data",
 *     permissions: ["data.read"],
 *   })
 *   async getData(ctx: EndpointCtx) {
 *     // ctx.user está garantizado no-null porque permissions no está vacío
 *     return { data: await this.fetchData(), user: ctx.user!.username };
 *   }
 *
 *   @EnableEndpoints()
 *   async start(kernelKey: symbol) {
 *     await super.start(kernelKey);
 *   }
 *
 *   @DisableEndpoints()
 *   async stop(kernelKey: symbol) {
 *     await super.stop(kernelKey);
 *   }
 * }
 * ```
 */
export default class EndpointManagerService extends BaseService {
	public readonly name = "EndpointManagerService";

	#httpProvider: IHostBasedHttpProvider | null = null;
	#sessionManager: SessionManagerService | null = null;

	/** Endpoints registrados indexados por ID */
	#endpoints: Map<string, RegisteredEndpoint> = new Map();

	/** Índice de endpoints por owner para cleanup rápido */
	#endpointsByOwner: Map<string, Set<string>> = new Map();

	/** Contador para generar IDs únicos */
	#idCounter = 0;

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);

		// Obtener HTTP provider
		this.#httpProvider = this.getMyProvider<IHostBasedHttpProvider>("fastify-server");

		// SessionManager se carga con lazy-load pattern en #getSessionManager()

		this.logger.logOk("EndpointManagerService iniciado");
	}

	/**
	 * Lazy-load singleton getter para SessionManagerService
	 * Intenta obtener el servicio solo si no está cargado
	 */
	#getSessionManager(): SessionManagerService | null {
		if (!this.#sessionManager) {
			try {
				this.#sessionManager = this.getMyService<SessionManagerService>("SessionManagerService");
			} catch {
				// SessionManagerService no disponible todavía
			}
		}
		return this.#sessionManager;
	}

	/**
	 * Registra un endpoint en Fastify con wrapper de permisos
	 * El handler es puro: recibe EndpointCtx y devuelve datos
	 */
	async registerEndpoint(config: {
		method: HttpMethod;
		url: string;
		permissions: string[];
		options?: EndpointConfig["options"];
		instance: object;
		methodName: string;
		handler: EndpointHandler<any, any, any>;
		ownerName: string;
	}): Promise<string> {
		if (!this.#httpProvider) {
			throw new Error("HTTP provider no disponible");
		}

		const id = `ep_${++this.#idCounter}_${config.ownerName}_${config.methodName}`;

		const endpoint: RegisteredEndpoint = {
			id,
			method: config.method,
			url: config.url,
			permissions: config.permissions,
			options: config.options,
			instance: config.instance,
			methodName: config.methodName,
			handler: config.handler,
			ownerName: config.ownerName,
		};

		// Guardar en registro
		this.#endpoints.set(id, endpoint);

		// Indexar por owner
		if (!this.#endpointsByOwner.has(config.ownerName)) {
			this.#endpointsByOwner.set(config.ownerName, new Set());
		}
		this.#endpointsByOwner.get(config.ownerName)!.add(id);

		// Inyectar el validador de permisos en la instancia
		setPermissionValidator(config.instance, this.#createPermissionValidatorFn());

		// Crear wrapper HTTP que construye ctx y maneja HttpError
		const wrappedHandler = this.#createHttpWrapper(endpoint);

		// Registrar en Fastify
		this.#httpProvider.registerRoute(config.method, config.url, wrappedHandler);

		this.logger.logDebug(`Endpoint registrado: ${config.method} ${config.url} [${config.ownerName}]`);

		return id;
	}

	/**
	 * Desregistra todos los endpoints de un owner específico
	 */
	async unregisterEndpointsByOwner(ownerName: string): Promise<number> {
		const endpointIds = this.#endpointsByOwner.get(ownerName);
		if (!endpointIds) {
			return 0;
		}

		let count = 0;
		for (const id of endpointIds) {
			const endpoint = this.#endpoints.get(id);
			if (endpoint) {
				this.#endpoints.delete(id);
				count++;
				this.logger.logDebug(`Endpoint desregistrado: ${endpoint.method} ${endpoint.url}`);
			}
		}

		this.#endpointsByOwner.delete(ownerName);
		return count;
	}

	/**
	 * Desregistra un endpoint específico por ID
	 */
	async unregisterEndpoint(id: string): Promise<boolean> {
		const endpoint = this.#endpoints.get(id);
		if (!endpoint) {
			return false;
		}

		this.#endpoints.delete(id);

		// Limpiar índice de owner
		const ownerSet = this.#endpointsByOwner.get(endpoint.ownerName);
		if (ownerSet) {
			ownerSet.delete(id);
			if (ownerSet.size === 0) {
				this.#endpointsByOwner.delete(endpoint.ownerName);
			}
		}

		this.logger.logDebug(`Endpoint desregistrado: ${endpoint.method} ${endpoint.url}`);
		return true;
	}

	/**
	 * Llama a un método de otro servicio con validación de permisos
	 *
	 * @param request - Configuración de la llamada
	 * @returns Resultado de la llamada
	 */
	async callService<T>(request: ServiceCallRequest): Promise<ServiceCallResponse<T>> {
		const { serviceName, methodName, args, requiredPermissions, callerToken } = request;

		// Validar permisos si se requieren
		if (requiredPermissions && requiredPermissions.length > 0) {
			const validator = this.#createPermissionValidatorFn();
			const authResult = await validator(callerToken || null, requiredPermissions);
			if (!authResult.valid) {
				return {
					success: false,
					error: authResult.error || "Permisos insuficientes",
				};
			}
		}

		try {
			// Obtener el servicio desde el registry
			const service = this.getMyService<any>(serviceName);
			if (!service) {
				return {
					success: false,
					error: `Servicio ${serviceName} no encontrado`,
				};
			}

			// Verificar que el método existe
			if (typeof service[methodName] !== "function") {
				return {
					success: false,
					error: `Método ${methodName} no existe en ${serviceName}`,
				};
			}

			// Ejecutar el método
			const result = await service[methodName](...args);

			return {
				success: true,
				result: result as T,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message || "Error ejecutando servicio",
			};
		}
	}

	/**
	 * Obtiene información sobre los endpoints registrados
	 */
	getRegisteredEndpoints(): Array<{
		id: string;
		method: HttpMethod;
		url: string;
		permissions: string[];
		ownerName: string;
	}> {
		return Array.from(this.#endpoints.values()).map((ep) => ({
			id: ep.id,
			method: ep.method,
			url: ep.url,
			permissions: ep.permissions,
			ownerName: ep.ownerName,
		}));
	}

	/**
	 * Obtiene estadísticas del servicio
	 */
	getStats(): {
		totalEndpoints: number;
		endpointsByOwner: Record<string, number>;
		publicEndpoints: number;
		protectedEndpoints: number;
	} {
		const endpointsByOwner: Record<string, number> = {};
		let publicEndpoints = 0;
		let protectedEndpoints = 0;

		for (const [owner, ids] of this.#endpointsByOwner) {
			endpointsByOwner[owner] = ids.size;
		}

		for (const ep of this.#endpoints.values()) {
			if (ep.permissions.length === 0) {
				publicEndpoints++;
			} else {
				protectedEndpoints++;
			}
		}

		return {
			totalEndpoints: this.#endpoints.size,
			endpointsByOwner,
			publicEndpoints,
			protectedEndpoints,
		};
	}

	/**
	 * Crea la función de validación de permisos para inyectar en los decoradores
	 */
	#createPermissionValidatorFn() {
		return async (
			token: string | null,
			requiredPermissions: string[]
		): Promise<{
			valid: boolean;
			user: AuthenticatedUserInfo | null;
			error?: string;
		}> => {
			const sessionManager = this.#getSessionManager();

			// Si no hay permisos requeridos, es público
			if (requiredPermissions.length === 0) {
				// Intentar obtener usuario si hay token (opcional)
				if (token && sessionManager) {
					const result = await sessionManager.verifyToken(token);
					if (result.valid && result.session) {
						return { valid: true, user: result.session.user };
					}
				}
				return { valid: true, user: null };
			}

			// Permisos requeridos - necesitamos token válido
			if (!token) {
				return { valid: false, user: null, error: "Token de autenticación requerido" };
			}

			if (!sessionManager) {
				return { valid: false, user: null, error: "Sistema de autenticación no disponible" };
			}

			const result = await sessionManager.verifyToken(token);

			if (!result.valid || !result.session) {
				return { valid: false, user: null, error: result.error || "Token inválido o expirado" };
			}

			const user = result.session.user;
			const userPermissions = new Set(user.permissions || []);

			// Verificar que el usuario tiene al menos uno de los permisos requeridos
			const hasPermission = requiredPermissions.some((perm) => {
				if (userPermissions.has(perm)) return true;
				const wildcardPerm = perm.split(".").slice(0, -1).join(".") + ".*";
				if (userPermissions.has(wildcardPerm)) return true;
				if (userPermissions.has("*")) return true;
				return false;
			});

			if (!hasPermission) {
				return {
					valid: false,
					user,
					error: `Permisos insuficientes. Requerido: ${requiredPermissions.join(" o ")}`,
				};
			}

			return { valid: true, user };
		};
	}

	/**
	 * Crea un wrapper HTTP que construye EndpointCtx y maneja HttpError
	 * La validación de permisos ya está en el decorador @RegisterEndpoint
	 */
	#createHttpWrapper(endpoint: RegisteredEndpoint): (req: FastifyRequest<any>, reply: FastifyReply<any>) => Promise<void> {
		return async (req: FastifyRequest<any>, reply: FastifyReply<any>) => {
			// Extraer token si existe
			const token = this.#extractToken(req);

			// Obtener usuario si hay token (ya sea público o protegido)
			let user: AuthenticatedUserInfo | null = null;
			const sessionManager = this.#getSessionManager();
			if (token && sessionManager) {
				const result = await sessionManager.verifyToken(token);
				if (result.valid && result.session) {
					user = result.session.user;
				}
			}

			// Construir EndpointCtx
			const ctx: EndpointCtx<any, any> = {
				params: (req.params as Record<string, string>) || {},
				query: (req.query as Record<string, string | undefined>) || {},
				data: req.body,
				user,
				token,
				cookies: ((req as any).cookies as Record<string, string | undefined>) || {},
				headers: req.headers as Record<string, string | undefined>,
				ip: req.ip,
			};

			try {
				// Llamar al handler (ya incluye validación de permisos en el decorator)
				const result = await endpoint.handler(ctx);

				// El handler devuelve datos, nosotros manejamos la respuesta HTTP
				if (result === undefined || result === null) {
					reply.status(204).send();
				} else {
					reply.status(200).send(result);
				}
			} catch (error: any) {
				// Capturar UncommonResponse para respuestas especiales (cookies, redirects)
				if (error instanceof UncommonResponse) {
					const rep = reply as any;
					// Establecer cookies
					for (const cookie of error.cookies) {
						rep.setCookie(cookie.name, cookie.value, cookie.options || {});
					}
					// Limpiar cookies
					for (const cookie of error.clearCookies) {
						rep.clearCookie(cookie.name, cookie.options || {});
					}
					// Establecer headers custom
					for (const [name, value] of Object.entries(error.headers)) {
						reply.header(name, value);
					}
					// Redirect o JSON
					if (error.type === "redirect") {
						reply.status(error.status).redirect(error.redirectUrl!);
					} else {
						reply.status(error.status).send(error.body);
					}
					return;
				}

				// Capturar ADCCustomError (HttpError y otros) para errores de negocio
				else if (error instanceof ADCCustomError) {
					reply.status(error.status).send(error.toJSON());
					return;
				}

				// Error inesperado
				this.logger.logError(`Error en endpoint ${endpoint.method} ${endpoint.url}: ${error.message}`);

				reply.status(500).send({
					error: "INTERNAL_ERROR",
					message: process.env.NODE_ENV === "development" ? error.message : "Error interno del servidor",
				});
			}
		};
	}

	/**
	 * Extrae el token de autenticación del request
	 */
	#extractToken(req: FastifyRequest<any>): string | null {
		// 1. Intentar desde cookie via SessionManager
		const sessionManager = this.#getSessionManager();
		if (sessionManager) {
			const cookieToken = sessionManager.extractSessionToken(req as any);
			if (cookieToken) return cookieToken;
		}

		// 2. Intentar desde header Authorization
		const authHeader = req.headers?.authorization;
		if (authHeader && authHeader.startsWith("Bearer ")) {
			return authHeader.substring(7);
		}

		// 3. Intentar desde query parameter (para WebSockets, etc.)
		const queryToken = (req.query as any)?.token;
		if (queryToken) {
			return queryToken;
		}

		return null;
	}

	async stop(kernelKey: symbol): Promise<void> {
		// Limpiar todos los endpoints
		this.#endpoints.clear();
		this.#endpointsByOwner.clear();

		this.#httpProvider = null;
		this.#sessionManager = null;

		await super.stop(kernelKey);
		this.logger.logDebug("EndpointManagerService detenido");
	}
}
