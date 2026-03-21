import { BaseService } from "../../BaseService.js";
import type { IHostBasedHttpProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import { type HttpMethod, type EndpointConfig, type EndpointHandler } from "./types.js";
import { setPermissionValidator } from "./decorators.js";
import SessionManagerService from "../../security/SessionManagerService/index.ts";
import { EndpointRegistry } from "./parts/registry.js";
import { createPermissionValidator } from "./parts/validator.js";
import { createHttpWrapper } from "./parts/http.js";
import { internalCallEndpoint } from "./parts/internalCallEndpoint.ts";

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
 */
export default class EndpointManagerService extends BaseService {
	public readonly name = "EndpointManagerService";

	#httpProvider: IHostBasedHttpProvider | null = null;
	// SessionManager se carga con lazy-load pattern en #getSessionManager()
	#sessionManager: SessionManagerService | null = null;
	#registry = new EndpointRegistry(this.logger);

	async start(kernelKey: symbol): Promise<void> {
		await super.start(kernelKey);
		// Obtener HTTP provider
		this.#httpProvider = this.getMyProvider<IHostBasedHttpProvider>("fastify-server");
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

		// Delegar la creación y almacenamiento del endpoint al registro
		const endpoint = this.#registry.register(config);

		// Inyectar el validador de permisos en la instancia
		setPermissionValidator(config.instance, createPermissionValidator(this.#getSessionManager.bind(this)));

		// Crear wrapper HTTP que construye ctx y maneja HttpError
		const wrappedHandler = createHttpWrapper(endpoint, this.#getSessionManager.bind(this), this.logger);

		// Registrar en Fastify
		this.#httpProvider.registerRoute(config.method, config.url, wrappedHandler);

		this.logger.logDebug(`Endpoint registrado: ${config.method} ${config.url} [${config.ownerName}]`);

		return endpoint.id;
	}

	/**
	 * Elimina todos los endpoints asociados a un owner.
	 * @param ownerName El nombre del propietario.
	 * @returns El número de endpoints eliminados.
	 */
	unregisterEndpointsByOwner = this.#registry.unregisterByOwner;

	internalCallEndpoint = internalCallEndpoint;

	// Obtiene información sobre los endpoints registrados
	getRegisteredEndpoints = () => this.#registry.getAll();

	// Obtiene estadísticas del servicio
	getStats = () => this.#registry.getStats();

	async stop(kernelKey: symbol): Promise<void> {
		// Limpiar todos los endpoints
		this.#registry.clear();

		this.#httpProvider = null;
		this.#sessionManager = null;

		await super.stop(kernelKey);
		this.logger.logDebug("EndpointManagerService detenido");
	}
}
