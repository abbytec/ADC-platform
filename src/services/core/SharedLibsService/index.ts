import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as https from "node:https";
import { BaseService } from "../../BaseService.js";
import type { ISharedLibsService, SharedLibConfig } from "./types.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import type { IUIFederationService } from "../UIFederationService/types.js";

/**
 * SharedLibsService - Gestiona librerías compartidas (React, Vue, etc.)
 * 
 * **Instancias múltiples:**
 * Cada instancia gestiona una librería diferente mediante archivos config-*.json
 * 
 * **Funcionalidades:**
 * - Descarga librerías desde CDN (esm.sh) o usa archivos locales
 * - Registra las librerías en el import map
 * - Sirve los archivos vía HttpServerProvider
 * - Cache local de librerías descargadas
 * 
 * @example
 * ```typescript
 * // Instancia para React (config-react.json)
 * const reactLibs = kernel.getService<ISharedLibsService>("SharedLibsService:react");
 * 
 * // Descargar si no está en cache
 * await reactLibs.download();
 * ```
 */
export default class SharedLibsService extends BaseService<ISharedLibsService> {
	public readonly name = "SharedLibsService";

	private libConfig!: SharedLibConfig;
	private httpProvider: IHttpServerProvider | null = null;
	private ready = false;
	private readonly sharedLibsBaseDir: string;

	constructor(kernel: any, options?: any) {
		super(kernel, options);

		// Directorio base para librerías compartidas
		const isDevelopment = process.env.NODE_ENV === "development";
		const basePath = isDevelopment ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");
		this.sharedLibsBaseDir = path.resolve(basePath, "..", "temp", "shared-libs");

		// Cargar configuración de la instancia
		this.libConfig = {
			library: options?.library || "unknown",
			version: options?.version || "latest",
			importMapKeys: options?.importMapKeys || {},
			cdnSource: options?.cdnSource || "https://esm.sh",
			useLocal: options?.useLocal || false,
		};
	}

	async start(): Promise<void> {
		await super.start();

		// Crear directorio base si no existe
		await fs.mkdir(this.sharedLibsBaseDir, { recursive: true });

		// Obtener el HttpServerProvider
		try {
			this.httpProvider = await this.getProvider<IHttpServerProvider>("express-server");
			this.logger.logDebug("HttpServerProvider disponible");
		} catch (error: any) {
			this.logger.logWarn(`HttpServerProvider no disponible: ${error.message}`);
		}

		// Preparar la librería
		await this.#prepareLibrary();

		// Registrar en UIFederationService (si existe)
		try {
			await this.#registerInImportMap();
		} catch (error: any) {
			this.logger.logWarn(`No se pudo registrar en import map: ${error.message}`);
		}

		this.logger.logOk(`SharedLibsService (${this.libConfig.library}) iniciado`);
	}

	async stop(): Promise<void> {
		await super.stop();
	}

	async getInstance(): Promise<ISharedLibsService> {
		return {
			getConfig: this.getConfig.bind(this),
			download: this.download.bind(this),
			isReady: this.isReady.bind(this),
		};
	}

	getConfig(): SharedLibConfig {
		return this.libConfig;
	}

	async download(): Promise<void> {
		await this.#prepareLibrary();
	}

	isReady(): boolean {
		return this.ready;
	}

	/**
	 * Prepara la librería (descarga o verifica local)
	 */
	async #prepareLibrary(): Promise<void> {
		const libDir = path.join(this.sharedLibsBaseDir, this.libConfig.library);

		// Verificar si ya existe en cache
		try {
			await fs.access(libDir);
			this.logger.logDebug(`Librería ${this.libConfig.library} encontrada en cache`);
			this.ready = true;
			await this.#serveLibrary(libDir);
			return;
		} catch {
			// No existe, continuar con descarga
		}

		if (this.libConfig.useLocal) {
			this.logger.logWarn(`Librería ${this.libConfig.library} configurada como local pero no encontrada`);
			return;
		}

		// Descargar desde CDN
		try {
			await this.#downloadFromCDN(libDir);
			this.ready = true;
			await this.#serveLibrary(libDir);
		} catch (error: any) {
			this.logger.logError(`Error descargando ${this.libConfig.library}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Descarga la librería desde el CDN
	 */
	async #downloadFromCDN(targetDir: string): Promise<void> {
		this.logger.logInfo(`Descargando ${this.libConfig.library}@${this.libConfig.version} desde CDN...`);

		await fs.mkdir(targetDir, { recursive: true });

		// Construir URL del CDN (esm.sh format)
		const cdnUrl = `${this.libConfig.cdnSource}/${this.libConfig.library}@${this.libConfig.version}`;

		// Para simplificar, por ahora creamos un archivo proxy que importa desde el CDN
		// En producción, podrías descargar el archivo completo
		const proxyContent = `// Proxy para ${this.libConfig.library}@${this.libConfig.version}
export * from '${cdnUrl}';
export { default } from '${cdnUrl}';
`;

		const indexPath = path.join(targetDir, "index.js");
		await fs.writeFile(indexPath, proxyContent, "utf-8");

		this.logger.logOk(`${this.libConfig.library} descargado`);
	}

	/**
	 * Configura el servidor para servir la librería
	 */
	async #serveLibrary(libDir: string): Promise<void> {
		if (!this.httpProvider) {
			this.logger.logWarn("HttpServerProvider no disponible, no se puede servir la librería");
			return;
		}

		const urlPath = `/shared/${this.libConfig.library}`;
		this.httpProvider.serveStatic(urlPath, libDir);
		this.logger.logDebug(`Librería ${this.libConfig.library} servida en ${urlPath}`);
	}

	/**
	 * Registra las entradas de import map en UIFederationService
	 */
	async #registerInImportMap(): Promise<void> {
		// Por ahora, las shared libs se registran directamente en el import map
		// mediante sus URLs configuradas. UIFederationService las detectará
		// cuando genere el import map completo.
		
		// En una implementación más avanzada, SharedLibsService podría
		// comunicarse directamente con UIFederationService para registrar
		// sus entradas en el import map.
		
		this.logger.logDebug(`Import map keys configuradas: ${Object.keys(this.libConfig.importMapKeys).join(", ")}`);
	}
}

// Re-exportar tipos
export type { ISharedLibsService, SharedLibConfig } from "./types.js";

