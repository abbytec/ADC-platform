import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BaseService } from "../../BaseService.js";
import { Kernel } from "../../../kernel.js";
import type { IUIFederationService, RegisteredUIModule } from "./types.js";
import type { ImportMap, UIModuleConfig } from "../../../interfaces/modules/IUIModule.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

// Utilidades
import { copyDirectory } from "./utils/file-operations.js";
import { generateCompleteImportMap, createImportMapObject } from "./utils/import-map.js";
import { injectImportMapsInHTMLs, generateIndexHtml, generateMainEntryPoint } from "./utils/html-processor.js";

// Generadores de configuración
import { generateAstroConfig } from "./config-generators/astro.js";
import { generateStencilConfig } from "./config-generators/stencil.js";

// Builders
import { startRspackDevServer, buildStencilModule, buildViteModule, buildReactVueModule, buildAstroModule } from "./builders/module-builder.js";

export default class UIFederationService extends BaseService<IUIFederationService> {
	public readonly name = "UIFederationService";

	private readonly registeredModules = new Map<string, RegisteredUIModule>();
	private watchBuilds = new Map<string, any>();
	private importMap: ImportMap = { imports: {} };
	private httpProvider: IHttpServerProvider | null = null;
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

		await super.start();
		await this.#setupImportMapEndpoint();
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
			generateAstroConfig: this.generateAstroConfig.bind(this),
			generateStencilConfig: this.generateStencilConfig.bind(this),
			buildUIModule: this.buildUIModule.bind(this),
			refreshAllImportMaps: this.refreshAllImportMaps.bind(this),
			getStats: this.getStats.bind(this),
		};
	}

	async registerUIModule(name: string, appDir: string, uiConfig: UIModuleConfig): Promise<void> {
		this.logger.logInfo(`Registrando módulo UI: ${name}`);

		const module: RegisteredUIModule = {
			name,
			appDir,
			uiConfig,
			registeredAt: Date.now(),
			buildStatus: "pending",
		};

		this.registeredModules.set(name, module);
		this.#updateImportMap();

		try {
			const framework = uiConfig.framework || "astro";
			const isDevelopment = process.env.NODE_ENV === "development";
			const isStandalone = uiConfig.standalone || false;

			if (isStandalone || (isDevelopment && uiConfig.devPort)) {
				await this.#generateStandaloneFiles(appDir, uiConfig);
			}

			if (framework === "astro") {
				const configPath = await generateAstroConfig(appDir, uiConfig, this.options);
				this.logger.logDebug(`Configuración de Astro generada: ${configPath}`);
			} else if (framework === "stencil") {
				const configPath = await generateStencilConfig(appDir, uiConfig, this.uiOutputBaseDir);
				this.logger.logDebug(`Configuración de Stencil generada: ${configPath}`);
			}

			if (isDevelopment && uiConfig.devPort && (framework === "react" || framework === "vue")) {
				await this.buildUIModule(name);
			} else {
				const shouldBuild = isStandalone || framework === "vite" || framework === "astro" || framework === "stencil";

				if (shouldBuild) {
					try {
						await this.buildUIModule(name);
						await this.#injectImportMapsInModuleHTMLs(name);
					} catch (buildError: any) {
						this.logger.logWarn(`Build falló para ${name}, copiando archivos sin build: ${buildError.message}`);
						const targetOutputDir = path.join(this.uiOutputBaseDir, name);
						await fs.rm(targetOutputDir, { recursive: true, force: true });

						if (isStandalone) {
							await fs.mkdir(targetOutputDir, { recursive: true });
							await fs.copyFile(path.join(appDir, "index.html"), path.join(targetOutputDir, "index.html"));
						}

						await copyDirectory(path.join(appDir, "src"), path.join(targetOutputDir, "src"));
						module.outputPath = targetOutputDir;
						module.buildStatus = "built";

						await this.#injectImportMapsInModuleHTMLs(name);
					}
				} else {
					const targetOutputDir = path.join(this.uiOutputBaseDir, name);
					await fs.rm(targetOutputDir, { recursive: true, force: true });
					await copyDirectory(path.join(appDir, "src"), targetOutputDir);
					module.outputPath = targetOutputDir;
					module.buildStatus = "built";
				}
			}

			this.#updateImportMap();

			if (this.httpProvider && module.outputPath && !uiConfig.devPort) {
				const urlPath = `/${name}`;
				this.httpProvider.serveStatic(urlPath, module.outputPath);
				this.logger.logOk(`Módulo UI ${name} servido en http://localhost:${this.port}${urlPath}`);
			} else if (isDevelopment && uiConfig.devPort && (framework === "react" || framework === "vue")) {
				this.logger.logOk(`Módulo UI ${name} disponible SOLO en Dev Server http://localhost:${uiConfig.devPort}`);
			}
		} catch (error: any) {
			module.buildStatus = "error";
			this.logger.logError(`Error registrando módulo UI ${name}: ${error.message}`);
			throw error;
		}
	}

	async unregisterUIModule(name: string): Promise<void> {
		this.logger.logInfo(`Desregistrando módulo UI: ${name}`);

		const module = this.registeredModules.get(name);
		if (!module) {
			this.logger.logWarn(`Módulo UI ${name} no encontrado`);
			return;
		}

		this.registeredModules.delete(name);
		this.#updateImportMap();

		this.logger.logOk(`Módulo UI ${name} desregistrado`);
	}

	getImportMap(): ImportMap {
		return this.importMap;
	}

	async generateAstroConfig(appDir: string, config: UIModuleConfig): Promise<string> {
		return generateAstroConfig(appDir, config, this.options);
	}

	async generateStencilConfig(appDir: string, config: UIModuleConfig): Promise<string> {
		return generateStencilConfig(appDir, config, this.uiOutputBaseDir);
	}

	async buildUIModule(name: string): Promise<void> {
		const module = this.registeredModules.get(name);
		if (!module) {
			throw new Error(`Módulo UI ${name} no encontrado`);
		}

		module.buildStatus = "building";
		this.logger.logInfo(`Ejecutando build para ${name}...`);

		try {
			const framework = module.uiConfig.framework || "astro";
			const rootDir = path.resolve(process.cwd());
			const viteBin = path.join(rootDir, "node_modules", ".bin", "vite");
			const astroBin = path.join(rootDir, "node_modules", ".bin", "astro");
			const stencilBin = path.join(rootDir, "node_modules", ".bin", "stencil");
			const rspackBin = path.join(rootDir, "node_modules", ".bin", "rspack");
			const isDevelopment = process.env.NODE_ENV === "development";

			if (framework === "stencil") {
				const watcher = await buildStencilModule(module, stencilBin, this.uiOutputBaseDir, isDevelopment, this.logger);
				if (watcher) {
					this.watchBuilds.set(name, watcher);
				}
			} else if (framework === "react" || framework === "vue") {
				if (isDevelopment && module.uiConfig.devPort) {
					const watcher = await startRspackDevServer(module, rspackBin, this.registeredModules, this.uiOutputBaseDir, this.logger);
					this.watchBuilds.set(module.uiConfig.name, watcher);
				} else {
					await buildReactVueModule(module, this.registeredModules, this.uiOutputBaseDir, this.port, this.logger);
				}
			} else if (framework === "vite") {
				const watcher = await buildViteModule(module, viteBin, this.uiOutputBaseDir, isDevelopment, this.logger);
				if (watcher) {
					this.watchBuilds.set(name, watcher);
				}
			} else if (framework === "astro") {
				await buildAstroModule(module, astroBin, this.uiOutputBaseDir, this.logger);
			} else {
				throw new Error(`Framework no soportado: ${framework}`);
			}

			module.buildStatus = "built";

			if (!isDevelopment) {
				this.logger.logOk(`Build completado para ${name}`);
			}
		} catch (error: any) {
			module.buildStatus = "error";
			this.logger.logError(`Error en build de ${name}: ${error.message}`);
			throw error;
		}
	}

	async refreshAllImportMaps(): Promise<void> {
		this.logger.logInfo("Reinyectando import maps en todos los módulos...");

		for (const [name, module] of this.registeredModules.entries()) {
			if (module.buildStatus === "built" && module.outputPath) {
				await this.#injectImportMapsInModuleHTMLs(name);
			}
		}

		this.#updateImportMap();
		this.logger.logOk("Import maps actualizados en todos los módulos");
	}

	getStats(): { registeredModules: number; importMapEntries: number; modules: RegisteredUIModule[] } {
		return {
			registeredModules: this.registeredModules.size,
			importMapEntries: Object.keys(this.importMap.imports).length,
			modules: Array.from(this.registeredModules.values()),
		};
	}

	async #generateStandaloneFiles(appDir: string, config: UIModuleConfig): Promise<void> {
		const framework = config.framework || "astro";

		if (framework === "react" || framework === "vue") {
			const indexHtmlContent = generateIndexHtml(config.name, framework);
			await fs.writeFile(path.join(appDir, "index.html"), indexHtmlContent, "utf-8");
			this.logger.logDebug(`index.html generado para ${config.name}`);

			const mainExt = framework === "react" ? ".tsx" : ".ts";
			const mainPath = path.join(appDir, "src", `main${mainExt}`);
			try {
				await fs.access(mainPath);
			} catch {
				const mainContent = generateMainEntryPoint(framework);
				await fs.writeFile(mainPath, mainContent, "utf-8");
				this.logger.logDebug(`src/main${mainExt} generado para ${config.name}`);
			}
		}
	}

	async #setupImportMapEndpoint(): Promise<void> {
		if (!this.httpProvider) return;

		this.httpProvider.registerRoute("GET", "/importmap.json", (_req, res) => {
			res.setHeader("Content-Type", "application/json");
			res.json(this.importMap);
		});

		this.httpProvider.registerRoute("GET", "/", (_req, res) => {
			const layoutModule = this.registeredModules.get("layout");
			if (layoutModule && layoutModule.uiConfig.devPort) {
				res.redirect(`http://localhost:${layoutModule.uiConfig.devPort}/`);
			}
		});

		this.logger.logDebug("Endpoints registrados: /importmap.json, /");
	}

	#updateImportMap(): void {
		const imports = generateCompleteImportMap(this.registeredModules, this.port);
		this.importMap = createImportMapObject(imports);
		this.logger.logDebug(`Import map actualizado con ${Object.keys(this.importMap.imports).length} entradas`);
	}

	async #injectImportMapsInModuleHTMLs(moduleName: string): Promise<void> {
		const module = this.registeredModules.get(moduleName);
		if (!module || !module.outputPath) return;

		const importMap = generateCompleteImportMap(this.registeredModules, this.port);
		await injectImportMapsInHTMLs(module.outputPath, importMap, this.logger);
		this.logger.logDebug(`Import maps inyectados en HTMLs de ${moduleName}`);
	}
}

export type { IUIFederationService, RegisteredUIModule } from "./types.js";
