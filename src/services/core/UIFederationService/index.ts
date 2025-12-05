import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BaseService } from "../../BaseService.js";
import { Kernel } from "../../../kernel.js";
import type { IUIFederationService, RegisteredUIModule } from "./types.js";
import type { ImportMap, UIModuleConfig } from "../../../interfaces/modules/IUIModule.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";
import type { ILangManagerService } from "../LangManagerService/types.js";

// Utilidades
import { generateCompleteImportMap, createImportMapObject } from "./utils/import-map.js";
import { injectImportMapsInHTMLs, generateIndexHtml, generateMainEntryPoint } from "./utils/html-processor.js";
import { generateServiceWorker, generateI18nClientCode } from "./utils/service-worker-generator.js";

// Strategy Pattern
import { getStrategy, isFrameworkSupported, getSupportedFrameworks, parseFramework } from "./strategies/index.js";
import type { IBuildContext } from "./strategies/types.js";

const DEFAULT_NAMESPACE = "default";

export default class UIFederationService extends BaseService<IUIFederationService> {
	public readonly name = "UIFederationService";

	// Módulos organizados por namespace: Map<namespace, Map<moduleName, module>>
	private readonly registeredModules = new Map<string, Map<string, RegisteredUIModule>>();
	private watchBuilds = new Map<string, any>();
	// Import maps por namespace
	private importMaps = new Map<string, ImportMap>();
	private httpProvider: IHttpServerProvider | null = null;
	private langManager: ILangManagerService | null = null;
	private readonly uiOutputBaseDir: string;
	private port: number = 3000;

	constructor(kernel: any, options?: any) {
		super(kernel, options);

		const isDevelopment = process.env.NODE_ENV === "development";
		const basePath = isDevelopment ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");
		this.uiOutputBaseDir = path.resolve(basePath, "..", "temp", "ui-builds");

		this.port = options?.port || 3000;
	}

	async start(): Promise<void> {
		await fs.mkdir(this.uiOutputBaseDir, { recursive: true });

		try {
			this.logger.logInfo("Cargando HttpServerProvider...");

			const providerConfig = {
				name: "express-server",
				version: "latest",
				language: "typescript",
			};

			const provider = await Kernel.moduleLoader.loadProvider(providerConfig);
			this.kernel.registerProvider(provider.name, provider, provider.type, providerConfig, null);

			const providerModule = this.getProvider<any>("express-server");
			this.logger.logOk("HttpServerProvider cargado");

			this.httpProvider = await providerModule.getInstance();
		} catch (error: any) {
			this.logger.logError(`Error cargando HttpServerProvider: ${error.message}`);
			throw error;
		}

		// Obtener LangManagerService si está disponible
		try {
			const langService = this.kernel.getService<any>("LangManagerService");
			this.langManager = await langService.getInstance();
			this.logger.logDebug("LangManagerService conectado");
		} catch {
			this.logger.logDebug("LangManagerService no disponible, i18n deshabilitado");
		}

		await super.start();
		await this.#setupImportMapEndpoints();
		await this.httpProvider!.listen(this.port);

		this.logger.logOk("UIFederationService iniciado");
	}

	async stop(): Promise<void> {
		this.logger.logInfo("Deteniendo UIFederationService...");

		if (this.httpProvider) {
			await this.httpProvider.stop();
		}

		// Matar procesos de build watch
		for (const [name, watcher] of this.watchBuilds.entries()) {
			try {
				this.logger.logDebug(`Deteniendo watcher: ${name}`);

				if (watcher && typeof watcher.kill === "function") {
					watcher.kill("SIGTERM");
					await new Promise((resolve) => setTimeout(resolve, 1000));

					if (!watcher.killed) {
						this.logger.logDebug(`Forzando terminación de watcher: ${name}`);
						watcher.kill("SIGKILL");
					}

					if (watcher.pid && process.platform !== "win32") {
						try {
							process.kill(-watcher.pid, "SIGKILL");
						} catch (error: any) {
							this.logger.logDebug(`Error matando grupo de procesos ${watcher.pid}: ${error.message}`);
						}
					}
				}
			} catch (error: any) {
				this.logger.logWarn(`Error deteniendo watcher ${name}: ${error.message}`);
			}
		}
		this.watchBuilds.clear();

		this.logger.logOk("UIFederationService detenido");
		await super.stop();
	}

	async getInstance(): Promise<IUIFederationService> {
		return {
			registerUIModule: this.registerUIModule.bind(this),
			unregisterUIModule: this.unregisterUIModule.bind(this),
			getImportMap: this.getImportMap.bind(this),
			buildUIModule: this.buildUIModule.bind(this),
			refreshAllImportMaps: this.refreshAllImportMaps.bind(this),
			getStats: this.getStats.bind(this),
		};
	}

	/**
	 * Obtiene el Map de módulos para un namespace específico
	 */
	#getNamespaceModules(namespace: string): Map<string, RegisteredUIModule> {
		if (!this.registeredModules.has(namespace)) {
			this.registeredModules.set(namespace, new Map());
		}
		return this.registeredModules.get(namespace)!;
	}

	/**
	 * Obtiene un módulo específico por namespace y nombre
	 */
	#getModule(namespace: string, name: string): RegisteredUIModule | null {
		const namespaceModules = this.registeredModules.get(namespace);
		if (!namespaceModules) return null;
		return namespaceModules.get(name) || null;
	}

	/**
	 * Busca un módulo por nombre en todos los namespaces (legacy, para retrocompatibilidad)
	 */
	#findModuleByName(name: string): { namespace: string; module: RegisteredUIModule } | null {
		for (const [namespace, modules] of this.registeredModules.entries()) {
			if (modules.has(name)) {
				return { namespace, module: modules.get(name)! };
			}
		}
		return null;
	}

	/**
	 * Registra un módulo UI
	 */
	async registerUIModule(name: string, appDir: string, uiConfig: UIModuleConfig): Promise<void> {
		const namespace = uiConfig.uiNamespace || DEFAULT_NAMESPACE;
		const framework = uiConfig.framework || "astro";

		// Validar framework soportado
		if (!isFrameworkSupported(framework)) {
			throw new Error(`Framework "${framework}" no soportado. ` + `Opciones: ${getSupportedFrameworks().join(", ")}`);
		}

		// Obtener y validar estrategia
		const strategy = getStrategy(framework);
		strategy.validateConfig(uiConfig);

		this.logger.logInfo(`Registrando módulo UI: ${name} [${namespace}] (${strategy.name})`);

		const namespaceModules = this.#getNamespaceModules(namespace);
		const isDevelopment = process.env.NODE_ENV === "development";
		const isStandalone = uiConfig.standalone || false;

		const module: RegisteredUIModule = {
			name,
			namespace,
			appDir,
			uiConfig: { ...uiConfig, uiNamespace: namespace },
			registeredAt: Date.now(),
			buildStatus: "pending",
		};

		namespaceModules.set(name, module);
		this.#updateImportMap(namespace);

		try {
			// Generar archivos standalone si es necesario
			if (isStandalone || strategy.requiresDevPort()) {
				await this.#generateStandaloneFiles(appDir, uiConfig);
			}

			// Build del módulo usando la estrategia
			await this.#buildUIModuleInternal(module, namespace);

			// Post-build: inyectar import maps si tiene output
			if (module.outputPath) {
				await this.#injectImportMapsInModuleHTMLs(name, namespace);
			}

			this.#updateImportMap(namespace);

			// Servir módulo según su configuración
			await this.#serveModule(module, namespace, isDevelopment);

			// Registrar traducciones i18n si está habilitado
			if (uiConfig.i18n && this.langManager) {
				await this.langManager.registerNamespace(name, appDir);
			}

			// Generar y registrar service worker si está habilitado (solo para layouts/hosts)
			if (uiConfig.serviceWorker && name === "layout") {
				await this.#registerServiceWorkerEndpoints(namespace);
			}
		} catch (error: any) {
			module.buildStatus = "error";
			this.logger.logError(`Error registrando módulo UI ${name}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Sirve el módulo según su configuración
	 */
	async #serveModule(module: RegisteredUIModule, namespace: string, isDevelopment: boolean): Promise<void> {
		const { bundler } = parseFramework(module.uiConfig.framework || "astro");

		// Módulos con devPort (rspack/vite): se sirven en su propio puerto
		if (module.uiConfig.devPort && (bundler === "rspack" || bundler === "vite")) {
			const mode = isDevelopment ? "Dev Server" : "Production Server";
			this.logger.logOk(`Módulo UI ${module.name} [${namespace}] disponible en ${mode} http://localhost:${module.uiConfig.devPort}`);
		}
		// Módulos sin devPort o CLI: servir estáticamente desde httpProvider
		else if (this.httpProvider && module.outputPath) {
			const urlPath = `/${namespace}/${module.name}`;
			this.httpProvider.serveStatic(urlPath, module.outputPath);
			this.logger.logOk(`Módulo UI ${module.name} [${namespace}] servido en http://localhost:${this.port}${urlPath}`);
		}
	}

	async unregisterUIModule(name: string, namespace?: string): Promise<void> {
		this.logger.logInfo(`Desregistrando módulo UI: ${name}`);

		// Si se proporciona namespace, usar ese directamente
		if (namespace) {
			const namespaceModules = this.registeredModules.get(namespace);
			if (namespaceModules && namespaceModules.has(name)) {
				namespaceModules.delete(name);
				this.#updateImportMap(namespace);
				this.logger.logOk(`Módulo UI ${name} [${namespace}] desregistrado`);
				return;
			}
		}

		// Fallback: buscar en todos los namespaces
		const found = this.#findModuleByName(name);
		if (!found) {
			this.logger.logWarn(`Módulo UI ${name} no encontrado`);
			return;
		}

		const { namespace: foundNamespace } = found;
		const namespaceModules = this.#getNamespaceModules(foundNamespace);
		namespaceModules.delete(name);
		this.#updateImportMap(foundNamespace);

		this.logger.logOk(`Módulo UI ${name} [${foundNamespace}] desregistrado`);
	}

	getImportMap(namespace?: string): ImportMap {
		const ns = namespace || DEFAULT_NAMESPACE;
		return this.importMaps.get(ns) || { imports: {} };
	}

	/**
	 * Build público (para retrocompatibilidad)
	 */
	async buildUIModule(name: string, namespace?: string): Promise<void> {
		let module: RegisteredUIModule | null = null;
		let ns = namespace || DEFAULT_NAMESPACE;

		if (namespace) {
			module = this.#getModule(namespace, name);
		} else {
			const found = this.#findModuleByName(name);
			if (found) {
				module = found.module;
				ns = found.namespace;
			}
		}

		if (!module) {
			throw new Error(`Módulo UI ${name} no encontrado`);
		}

		await this.#buildUIModuleInternal(module, ns);
	}

	/**
	 * Build interno usando Strategy Pattern
	 */
	async #buildUIModuleInternal(module: RegisteredUIModule, namespace: string): Promise<void> {
		const framework = module.uiConfig.framework || "astro";
		const strategy = getStrategy(framework);
		const namespaceModules = this.#getNamespaceModules(namespace);
		const namespaceOutputDir = path.join(this.uiOutputBaseDir, namespace);

		module.buildStatus = "building";
		this.logger.logInfo(`Build: ${module.name} [${namespace}] usando ${strategy.name}`);

		try {
			// Crear contexto de build
			const context: IBuildContext = {
				module,
				namespace,
				registeredModules: namespaceModules,
				uiOutputBaseDir: namespaceOutputDir,
				logger: this.logger,
				isDevelopment: process.env.NODE_ENV === "development",
			};

			// Ejecutar build con la estrategia
			const result = await strategy.build(context);

			// Guardar watcher si existe
			if (result.watcher) {
				const watcherKey = `${namespace}:${module.name}`;
				this.watchBuilds.set(watcherKey, result.watcher);
			}

			// Guardar output path
			if (result.outputPath) {
				module.outputPath = result.outputPath;
			}

			module.buildStatus = "built";

			if (!context.isDevelopment) {
				this.logger.logOk(`Build completado para ${module.name} [${namespace}]`);
			}
		} catch (error: any) {
			module.buildStatus = "error";
			this.logger.logError(`Error en build de ${module.name}: ${error.message}`);
			throw error;
		}
	}

	async refreshAllImportMaps(): Promise<void> {
		this.logger.logInfo("Reinyectando import maps en todos los módulos...");

		for (const [namespace, modules] of this.registeredModules.entries()) {
			for (const [name, module] of modules.entries()) {
				if (module.buildStatus === "built" && module.outputPath) {
					await this.#injectImportMapsInModuleHTMLs(name, namespace);
				}
			}
			this.#updateImportMap(namespace);
		}

		this.logger.logOk("Import maps actualizados en todos los módulos");
	}

	getStats(): { registeredModules: number; importMapEntries: number; modules: RegisteredUIModule[]; namespaces: string[] } {
		const allModules: RegisteredUIModule[] = [];
		let totalImportEntries = 0;

		for (const [namespace, modules] of this.registeredModules.entries()) {
			allModules.push(...modules.values());
			const importMap = this.importMaps.get(namespace);
			if (importMap) {
				totalImportEntries += Object.keys(importMap.imports).length;
			}
		}

		return {
			registeredModules: allModules.length,
			importMapEntries: totalImportEntries,
			modules: allModules,
			namespaces: Array.from(this.registeredModules.keys()),
		};
	}

	async #generateStandaloneFiles(appDir: string, config: UIModuleConfig): Promise<void> {
		const { baseFramework } = parseFramework(config.framework || "astro");

		if (baseFramework === "react" || baseFramework === "vue") {
			const indexHtmlContent = generateIndexHtml(config.name, baseFramework);
			await fs.writeFile(path.join(appDir, "index.html"), indexHtmlContent, "utf-8");
			this.logger.logDebug(`index.html generado para ${config.name}`);

			const mainExt = baseFramework === "react" ? ".tsx" : ".ts";
			const mainPath = path.join(appDir, "src", `main${mainExt}`);
			try {
				await fs.access(mainPath);
			} catch {
				const mainContent = generateMainEntryPoint(baseFramework);
				await fs.writeFile(mainPath, mainContent, "utf-8");
				this.logger.logDebug(`src/main${mainExt} generado para ${config.name}`);
			}
		}
	}

	async #setupImportMapEndpoints(): Promise<void> {
		if (!this.httpProvider) return;

		// Endpoint para import map por namespace
		this.httpProvider.registerRoute("GET", "/:namespace/importmap.json", (req, res) => {
			const namespace = (req.params as any).namespace || DEFAULT_NAMESPACE;
			const importMap = this.importMaps.get(namespace) || { imports: {} };
			res.setHeader("Content-Type", "application/json");
			res.json(importMap);
		});

		// Endpoint legacy para import map (namespace default)
		this.httpProvider.registerRoute("GET", "/importmap.json", (_req, res) => {
			const importMap = this.importMaps.get(DEFAULT_NAMESPACE) || { imports: {} };
			res.setHeader("Content-Type", "application/json");
			res.json(importMap);
		});

		// Endpoint para listar namespaces disponibles
		this.httpProvider.registerRoute("GET", "/api/ui/namespaces", (_req, res) => {
			res.json({
				namespaces: Array.from(this.registeredModules.keys()),
				default: DEFAULT_NAMESPACE,
			});
		});

		// Endpoints i18n
		this.httpProvider.registerRoute("GET", "/api/i18n/:namespace", (req, res) => {
			const namespace = (req.params as any).namespace;
			const locale = (req.query as any).locale;

			if (!this.langManager) {
				res.status(503).json({ error: "LangManagerService no disponible" });
				return;
			}

			const translations = this.langManager.getTranslations(namespace, locale);
			res.setHeader("Content-Type", "application/json");
			res.json(translations);
		});

		this.httpProvider.registerRoute("GET", "/api/i18n", (req, res) => {
			const namespaces = ((req.query as any).namespaces || "").split(",").filter(Boolean);
			const locale = (req.query as any).locale;

			if (!this.langManager) {
				res.status(503).json({ error: "LangManagerService no disponible" });
				return;
			}

			if (namespaces.length === 0) {
				res.json(this.langManager.getStats());
				return;
			}

			const translations = this.langManager.getBundledTranslations(namespaces, locale);
			res.setHeader("Content-Type", "application/json");
			res.json(translations);
		});

		// Ruta raíz: redirigir al layout del namespace default
		this.httpProvider.registerRoute("GET", "/", (_req, res) => {
			const defaultModules = this.registeredModules.get(DEFAULT_NAMESPACE);
			const layoutModule = defaultModules?.get("layout");

			// Si layout tiene devPort: redirigir a su servidor (dev o prod)
			if (layoutModule && layoutModule.uiConfig.devPort) {
				res.redirect(`http://localhost:${layoutModule.uiConfig.devPort}/`);
			}
			// Si no hay devPort pero hay layout: redirigir al estático
			else if (layoutModule) {
				res.redirect(`/${DEFAULT_NAMESPACE}/layout/`);
			}
			// Si no hay layout en default, mostrar lista de namespaces
			else {
				const namespaces = Array.from(this.registeredModules.keys());
				res.send(`
					<!DOCTYPE html>
					<html>
					<head><title>UI Namespaces</title></head>
					<body style="font-family: system-ui; padding: 20px;">
						<h1>UI Namespaces Disponibles</h1>
						<ul>
							${namespaces
								.map((ns) => {
									const nsModules = this.registeredModules.get(ns);
									const nsLayout = nsModules?.get("layout");
									if (nsLayout?.uiConfig.devPort) {
										return `<li><a href="http://localhost:${nsLayout.uiConfig.devPort}/">${ns}</a></li>`;
									}
									return `<li><a href="/${ns}/layout/">${ns}</a></li>`;
								})
								.join("")}
						</ul>
					</body>
					</html>
				`);
			}
		});

		this.logger.logDebug("Endpoints registrados: /:namespace/importmap.json, /importmap.json, /api/ui/namespaces, /");
	}

	#updateImportMap(namespace: string): void {
		const namespaceModules = this.#getNamespaceModules(namespace);
		const imports = generateCompleteImportMap(namespaceModules, this.port, namespace);
		this.importMaps.set(namespace, createImportMapObject(imports));
		this.logger.logDebug(`Import map [${namespace}] actualizado con ${Object.keys(imports).length} entradas`);
	}

	async #injectImportMapsInModuleHTMLs(moduleName: string, namespace: string): Promise<void> {
		const module = this.#getModule(namespace, moduleName);
		if (!module || !module.outputPath) return;

		const namespaceModules = this.#getNamespaceModules(namespace);
		const importMap = generateCompleteImportMap(namespaceModules, this.port, namespace);
		await injectImportMapsInHTMLs(module.outputPath, importMap, this.logger);
		this.logger.logDebug(`Import maps inyectados en HTMLs de ${moduleName} [${namespace}]`);
	}

	async #registerServiceWorkerEndpoints(namespace: string): Promise<void> {
		if (!this.httpProvider) return;

		const namespaceModules = this.#getNamespaceModules(namespace);
		const layoutModule = namespaceModules.get("layout");

		if (!layoutModule) return;

		// Generar service worker para este namespace
		const swContent = generateServiceWorker(layoutModule, namespaceModules, this.port);
		const i18nClientContent = generateI18nClientCode(layoutModule, namespaceModules, this.port);

		// Endpoint para el service worker (servido desde la raíz del namespace o del devPort)
		const swPath = layoutModule.uiConfig.devPort ? "/adc-sw.js" : `/${namespace}/adc-sw.js`;
		const i18nPath = layoutModule.uiConfig.devPort ? "/adc-i18n.js" : `/${namespace}/adc-i18n.js`;

		// Registrar rutas solo si no están ya registradas
		try {
			this.httpProvider.registerRoute("GET", swPath, (_req, res) => {
				res.setHeader("Content-Type", "application/javascript");
				res.setHeader("Service-Worker-Allowed", "/");
				res.send(swContent);
			});

			this.httpProvider.registerRoute("GET", i18nPath, (_req, res) => {
				res.setHeader("Content-Type", "application/javascript");
				res.send(i18nClientContent);
			});

			this.logger.logDebug(`Service Worker [${namespace}] registrado en ${swPath}`);
			this.logger.logDebug(`i18n Client [${namespace}] registrado en ${i18nPath}`);
		} catch (error: any) {
			// Las rutas ya podrían existir si se recargó el módulo
			this.logger.logDebug(`Endpoints SW ya registrados para ${namespace}`);
		}
	}
}

export type { IUIFederationService, RegisteredUIModule } from "./types.js";
