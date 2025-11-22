import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { build, InlineConfig, createServer, ViteDevServer } from "vite";
import { BaseService } from "../../BaseService.js";
import { Kernel } from "../../../kernel.js";
import type { IUIFederationService, RegisteredUIModule } from "./types.js";
import type { ImportMap, UIModuleConfig } from "../../../interfaces/modules/IUIModule.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

const FRAMEWORK_PLUGINS = {
	react: {
		import: "import react from '@vitejs/plugin-react';",
		plugin: "react()",
	},
	vue: {
		import: "import vue from '@vitejs/plugin-vue';",
		plugin: "vue()",
	},
};

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

		// Matar procesos de build watch de manera más agresiva
		for (const [name, watcher] of this.watchBuilds.entries()) {
			try {
				this.logger.logDebug(`Deteniendo watcher: ${name}`);

				if (watcher && typeof watcher.kill === "function") {
					// Intentar primero con SIGTERM
					watcher.kill("SIGTERM");

					// Esperar un poco
					await new Promise((resolve) => setTimeout(resolve, 1000));

					// Si todavía está vivo, forzar con SIGKILL
					if (!watcher.killed) {
						this.logger.logDebug(`Forzando terminación de watcher: ${name}`);
						watcher.kill("SIGKILL");
					}

					// Si tiene PID, también matar el grupo de procesos completo
					if (watcher.pid) {
						try {
							// Matar el grupo de procesos (todos los hijos)
							if (process.platform !== "win32") {
								process.kill(-watcher.pid, "SIGKILL");
							}
						} catch (error: any) {
							// Ignorar errores (el proceso ya puede estar muerto)
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
				const configPath = await this.generateAstroConfig(appDir, uiConfig);
				this.logger.logDebug(`Configuración de Astro generada: ${configPath}`);
			} else if (framework === "stencil") {
				const configPath = await this.generateStencilConfig(appDir, uiConfig);
				this.logger.logDebug(`Configuración de Stencil generada: ${configPath}`);
			}

			if (isDevelopment && uiConfig.devPort && (framework === "react" || framework === "vue")) {
				await this.buildUIModule(name);
			} else {
				const shouldBuild = isStandalone || framework === "vite" || framework === "astro" || framework === "stencil";

				if (shouldBuild) {
					try {
						await this.buildUIModule(name);
						await this.#injectImportMapsInHTMLs(name);
					} catch (buildError: any) {
						this.logger.logWarn(`Build falló para ${name}, copiando archivos sin build: ${buildError.message}`);
						const targetOutputDir = path.join(this.uiOutputBaseDir, name);
						await fs.rm(targetOutputDir, { recursive: true, force: true });

						if (isStandalone) {
							await fs.mkdir(targetOutputDir, { recursive: true });
							await fs.copyFile(path.join(appDir, "index.html"), path.join(targetOutputDir, "index.html"));
						}

						await this.#copyDirectory(path.join(appDir, "src"), path.join(targetOutputDir, "src"));
						module.outputPath = targetOutputDir;
						module.buildStatus = "built";

						await this.#injectImportMapsInHTMLs(name);
					}
				} else {
					const targetOutputDir = path.join(this.uiOutputBaseDir, name);
					await fs.rm(targetOutputDir, { recursive: true, force: true });
					await this.#copyDirectory(path.join(appDir, "src"), targetOutputDir);
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

	private async getViteConfig(appDir: string, config: UIModuleConfig, isDev: boolean): Promise<InlineConfig> {
		const framework = config.framework || "vanilla";
		const outputDir = path.join(this.uiOutputBaseDir, config.name);
		const base = isDev ? "/" : `/${config.name}/`;
		const port = config.devPort || 0;
		const isStandalone = config.standalone || false;

		const plugins = [];

		if (isDev) {
			const registeredModules = this.registeredModules;
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const self = this;

			plugins.push({
				name: "inject-importmap",
				transformIndexHtml: {
					order: "pre",
					handler(html: string) {
						const importMap = self.#generateCompleteImportMap();
						const moduleCount = Object.keys(importMap).filter((k) => k.startsWith("@")).length;
						self.logger.logDebug(`[${config.name}] Inyectando import map con ${moduleCount} módulos federados`);

						const importMapScript = `    <script type="importmap">\n${JSON.stringify({ imports: importMap }, null, 6).replace(
							/\n/g,
							"\n    "
						)}\n    </script>`;
						const debugScript = `    <script>
      console.log('[UIFederation] Import map inyectado:', ${JSON.stringify(importMap)});
      console.log('[UIFederation] Módulos disponibles:', ${JSON.stringify(Object.keys(importMap).filter((k) => k.startsWith("@")))});
    </script>`;

						if (html.includes("</head>")) {
							return html.replace("</head>", `${importMapScript}\n${debugScript}\n  </head>`);
						}
						return html;
					},
				},
			});

			plugins.push({
				name: "federation-dev-resolver",
				enforce: "pre" as const,
				resolveId(source: string) {
					const federatedHosts: Record<string, string> = {};
					for (const [moduleName, module] of registeredModules.entries()) {
						if (module.uiConfig.devPort) {
							federatedHosts[`@${moduleName}/`] = `http://localhost:${module.uiConfig.devPort}/`;
						} else {
							federatedHosts[`@${moduleName}/`] = `http://localhost:3000/${moduleName}/`;
						}
					}

					for (const prefix of Object.keys(federatedHosts)) {
						const moduleName = prefix.slice(1, -1); // Quitar @ y /

						if (source === `@${moduleName}`) {
							return {
								id: `${federatedHosts[prefix]}src/App.tsx`,
								external: true,
							};
						}

						if (source.startsWith(prefix)) {
							const module = registeredModules.get(moduleName);
							const remainder = source.substring(prefix.length);

							if (module && module.uiConfig.framework === "vite") {
								const withJs = remainder.endsWith(".js") ? remainder : `${remainder}.js`;
								return {
									id: `${federatedHosts[prefix]}${withJs}`,
									external: true,
								};
							} else {
								const withoutJs = remainder.replace(/\.js$/, "");
								return {
									id: `${federatedHosts[prefix]}${withoutJs}`,
									external: true,
								};
							}
						}
					}
					return null;
				},
			} as any);
		}

		if (framework === "react" || framework === "vue") {
			if (framework === "react") {
				const { default: react } = await import("@vitejs/plugin-react");
				plugins.push(react());
			} else if (framework === "vue") {
				try {
					// @ts-expect-error - Plugin de Vue opcional
					const vueModule: any = await import("@vitejs/plugin-vue");
					const vue = vueModule.default;
					plugins.push(vue());
				} catch {
					this.logger.logWarn(`[${config.name}] @vitejs/plugin-vue no instalado - ejecuta: npm install --save-dev @vitejs/plugin-vue`);
				}
			}

			const isLayout = config.name === "layout";

			if (!isLayout && isDev) {
				try {
					const federationModule: any = await import("@originjs/vite-plugin-federation");
					const federation = federationModule.default;

					this.logger.logDebug(`[${config.name}] Configurando Vite como REMOTE (expone ./App)`);

					const mainExt = framework === "react" ? ".tsx" : framework === "vue" ? ".vue" : ".ts";

					plugins.push(
						federation({
							name: config.name,
							filename: "remoteEntry.js",
							exposes: {
								"./App": `./src/App${mainExt}`,
							},
							shared: {
								react: { singleton: true, requiredVersion: "^18.2.0" },
								"react-dom": { singleton: true, requiredVersion: "^18.2.0" },
							},
						}) as any
					);
				} catch (error: any) {
					this.logger.logWarn(`[${config.name}] Error configurando Vite MF: ${error.message}`);
				}
			}
		}

		const federatedModules: string[] = [];
		const externalModules: string[] = [];
		for (const moduleName of this.registeredModules.keys()) {
			federatedModules.push(`@${moduleName}`);
			externalModules.push(`@${moduleName}`);
			externalModules.push(moduleName);
			externalModules.push(moduleName + "/App");
			externalModules.push(moduleName + "/App.js");
		}

		const externals: (string | RegExp)[] = isDev ? [] : externalModules;

		const buildConfig: any = {
			outDir: outputDir,
			emptyOutDir: true,
		};

		if (isStandalone) {
			buildConfig.rollupOptions = {
				input: path.resolve(appDir, "index.html"),
				external: externals,
				output: {
					globals: { react: "React", "react-dom": "ReactDOM" },
				},
			};
		} else {
			buildConfig.lib = {
				entry: path.resolve(appDir, "src/App.tsx"),
				formats: ["es"],
				fileName: () => "App.js",
			};
			buildConfig.rollupOptions = {
				external: externals,
				output: {
					globals: { react: "React", "react-dom": "ReactDOM" },
				},
			};
		}

		return {
			configFile: false,
			root: appDir,
			base: base,
			plugins,
			resolve: {
				alias: {
					"@ui-library": path.resolve(process.cwd(), "src/apps/test/00-web-ui-library/src"),
				},
			},
			server: {
				port: port,
				strictPort: true,
				cors: {
					origin: "*",
					credentials: true,
				},
				hmr: {
					protocol: "ws",
					host: "localhost",
					port: port,
				},
			},
			optimizeDeps: {
				include: isDev ? ["react", "react-dom", "react-dom/client"] : [],
				exclude: federatedModules,
			},
			define: {
				"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
			},
			build: buildConfig,
		};
	}

	async generateStencilConfig(appDir: string, config: UIModuleConfig): Promise<string> {
		const targetDir = path.join(this.uiOutputBaseDir, config.name);
		const relativeOutputDir = path.relative(appDir, targetDir);

		const stencilConfig: any = {
			namespace: config.name,
			outputTargets: [
				{
					type: "dist",
					dir: relativeOutputDir,
				},
				{
					type: "dist-custom-elements",
					dir: `${relativeOutputDir}/custom-elements`,
					customElementsExportBehavior: "auto-define-custom-elements",
					externalRuntime: false,
				},
				{
					type: "docs-readme",
				},
			],
			sourceMap: true,
			buildEs5: false,
			copy: [{ src: "utils" }],
		};

		const configContent = `import { Config } from '@stencil/core';\n\nexport const config: Config = ${JSON.stringify(
			stencilConfig,
			null,
			2
		)};\n`;

		const configPath = path.join(appDir, "stencil.config.ts");
		await fs.writeFile(configPath, configContent, "utf-8");

		return configPath;
	}

	/**
	 * Genera el archivo astro.config.mjs para una app
	 */
	async generateAstroConfig(appDir: string, config: UIModuleConfig): Promise<string> {
		const outputDir = config.outputDir || "dist-ui";
		const astroDefaults = this.options?.astroDefaults || {
			output: "static",
			build: { format: "file" },
		};

		const sharedLibs = config.sharedLibs || [];
		const needsReact = sharedLibs.includes("react");
		const needsVue = sharedLibs.includes("vue");

		const imports: string[] = ["import { defineConfig } from 'astro/config';"];
		const integrations: string[] = [];

		if (needsReact) {
			imports.push("import react from '@astrojs/react';");
			integrations.push("react()");
		}
		if (needsVue) {
			imports.push("import vue from '@astrojs/vue';");
			integrations.push("vue()");
		}

		const finalConfig = {
			...astroDefaults,
			...(config.astroConfig || {}),
			outDir: `./${outputDir}`,
		};

		const configContentParts: string[] = [
			``,
			imports.join("\n"),
			``,
			`export default defineConfig({`,
			`  output: "${finalConfig.output}",`,
			`  outDir: "${finalConfig.outDir}",`,
		];

		const buildConfig = {
			...(finalConfig.build || {}),
			format: "directory",
		};

		configContentParts.push(`  build: ${JSON.stringify(buildConfig)},`);

		if (integrations.length > 0) {
			configContentParts.push(`  integrations: [${integrations.join(", ")}],`);
		}

		configContentParts.push(`});`);

		const configContent = configContentParts.join("\n");

		const configPath = path.join(appDir, "astro.config.mjs");
		await fs.writeFile(configPath, configContent, "utf-8");

		return configPath;
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
			const isLayout = name === "layout";

			if (framework === "stencil") {
				const isDevelopment = process.env.NODE_ENV === "development";

				if (isDevelopment) {
					this.logger.logDebug(`Iniciando Stencil build en watch mode para ${name}`);

					const watcher = spawn(stencilBin, ["build", "--watch"], {
						cwd: module.appDir,
						stdio: "pipe",
						shell: false,
						detached: process.platform !== "win32",
					});

					watcher.stdout?.on("data", (data) => {
						const output = data.toString();
						if (output.includes("build finished")) {
							this.logger.logDebug(`Stencil build actualizado para ${name}`);
						}
					});

					watcher.stderr?.on("data", (data) => this.logger.logDebug(`Stencil watch ${name}: ${data.toString().slice(0, 200)}`));
					watcher.on("error", (error) => this.logger.logError(`Error en watcher de Stencil ${name}: ${error.message}`));
					watcher.on("exit", (code, signal) =>
						this.logger.logDebug(`Stencil watcher ${name} terminado (code: ${code}, signal: ${signal})`)
					);

					this.watchBuilds.set(name, watcher);
					await new Promise((resolve) => setTimeout(resolve, 5000)); // Dar tiempo a que el build inicial termine
				} else {
					await this.#runCommand(stencilBin, ["build"], module.appDir);
				}

				module.outputPath = path.join(this.uiOutputBaseDir, name);

				const loaderIndexPath = path.join(module.outputPath, "loader", "index.js");
				try {
					await fs.access(loaderIndexPath);
					let content = await fs.readFile(loaderIndexPath, "utf-8");

					if (!content.includes("defineCustomElements(window)")) {
						content = content.replace(
							"export * from '../esm/loader.js';",
							`import { defineCustomElements } from '../esm/loader.js';\nexport * from '../esm/loader.js';\ndefineCustomElements(window);`
						);
						await fs.writeFile(loaderIndexPath, content, "utf-8");
						this.logger.logDebug(`defineCustomElements inyectado en loader para ${name}`);
					}
				} catch {
					this.logger.logWarn(`No se encontró loader/index.js para ${name}. El módulo podría no autocargarse.`);
				}
			} else if (framework === "react" || framework === "vue") {
				if (isDevelopment && module.uiConfig.devPort) {
					await this.#startRspackDevServer(module, rspackBin);
				} else {
					const viteConfig = await this.getViteConfig(module.appDir, module.uiConfig, false);
					this.logger.logDebug(`Iniciando build programático para ${name}`);
					await build(viteConfig);
					const outputPath = path.join(this.uiOutputBaseDir, name);
					module.outputPath = outputPath;
					await this.#copyPublicFiles(module.appDir, outputPath);
				}
			} else if (framework === "vite") {
				const isDevelopment = process.env.NODE_ENV === "development";

				if (isDevelopment) {
					this.logger.logDebug(`Iniciando Vite build en watch mode para ${name}`);

					// Spawn en su propio grupo de procesos para poder matar todos los hijos
					const spawnOptions: any = {
						cwd: module.appDir,
						stdio: "pipe",
						shell: false,
						detached: process.platform !== "win32",
					};

					const watcher = spawn(viteBin, ["build", "--watch"], spawnOptions);

					watcher.stdout?.on("data", (data) => {
						const output = data.toString();
						if (output.includes("built in")) {
							this.logger.logDebug(`Vite build actualizado para ${name}`);
						}
					});

					watcher.stderr?.on("data", (data) => {
						this.logger.logDebug(`Vite watch ${name}: ${data.toString().slice(0, 200)}`);
					});

					watcher.on("error", (error) => {
						this.logger.logError(`Error en watcher de Vite ${name}: ${error.message}`);
					});

					watcher.on("exit", (code, signal) => {
						this.logger.logDebug(`Vite watcher ${name} terminado (code: ${code}, signal: ${signal})`);
					});

					this.watchBuilds.set(name, watcher);

					await new Promise((resolve) => setTimeout(resolve, 3000));
				} else {
					await this.#runCommand(viteBin, ["build"], module.appDir);
				}

				const sourceOutputDir = path.join(module.appDir, module.uiConfig.outputDir);
				const targetOutputDir = path.join(this.uiOutputBaseDir, name);
				await fs.rm(targetOutputDir, { recursive: true, force: true });
				await this.#copyDirectory(sourceOutputDir, targetOutputDir);
				module.outputPath = targetOutputDir;
			} else if (framework === "astro") {
				await this.#runCommand(astroBin, ["build"], module.appDir);

				const sourceOutputDir = path.join(module.appDir, module.uiConfig.outputDir);
				const targetOutputDir = path.join(this.uiOutputBaseDir, name);
				await fs.rm(targetOutputDir, { recursive: true, force: true });
				await this.#copyDirectory(sourceOutputDir, targetOutputDir);
				module.outputPath = targetOutputDir;
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
				await this.#injectImportMapsInHTMLs(name);
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
			const indexHtmlContent = this.#generateIndexHtml(config);
			await fs.writeFile(path.join(appDir, "index.html"), indexHtmlContent, "utf-8");
			this.logger.logDebug(`index.html generado para ${config.name}`);

			const mainExt = framework === "react" ? ".tsx" : ".ts";
			const mainPath = path.join(appDir, "src", `main${mainExt}`);
			try {
				await fs.access(mainPath);
			} catch {
				const mainContent = this.#generateMainEntryPoint(config);
				await fs.writeFile(mainPath, mainContent, "utf-8");
				this.logger.logDebug(`src/main${mainExt} generado para ${config.name}`);
			}
		}
	}

	async #copyPublicFiles(appDir: string, outputDir: string): Promise<void> {
		const publicDir = path.join(appDir, "public");
		try {
			await fs.access(publicDir);
			const entries = await fs.readdir(publicDir);
			for (const entry of entries) {
				const sourcePath = path.join(publicDir, entry);
				const targetPath = path.join(outputDir, entry);
				await fs.copyFile(sourcePath, targetPath);
			}
			this.logger.logDebug(`Archivos públicos copiados desde ${publicDir}`);
		} catch {
			this.logger.logDebug(`No hay directorio public/ en ${appDir}`);
		}
	}

	/**
	 * Genera el contenido de index.html para una app standalone
	 */
	#generateIndexHtml(config: UIModuleConfig): string {
		const framework = config.framework || "astro";
		const title = config.name.charAt(0).toUpperCase() + config.name.slice(1).replace(/-/g, " ");
		const mainExt = framework === "react" ? ".tsx" : ".ts";

		return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main${mainExt}"></script>
  </body>
</html>
`;
	}

	#generateMainEntryPoint(config: UIModuleConfig): string {
		const framework = config.framework || "astro";

		if (framework === "react") {
			return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
`;
		} else if (framework === "vue") {
			return `import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#root');
`;
		}

		return "";
	}

	async #setupImportMapEndpoint(): Promise<void> {
		if (!this.httpProvider) return;

		this.httpProvider.registerRoute("GET", "/importmap.json", (req, res) => {
			res.setHeader("Content-Type", "application/json");
			res.json(this.importMap);
		});

		this.httpProvider.registerRoute("GET", "/", (req, res) => {
			const layoutModule = this.registeredModules.get("layout");
			if (layoutModule && layoutModule.uiConfig.devPort) {
				res.redirect(`http://localhost:${layoutModule.uiConfig.devPort}/`);
			}
		});

		this.logger.logDebug("Endpoints registrados: /importmap.json, /");
	}

	#generateCompleteImportMap(): Record<string, string> {
		const isDevelopment = process.env.NODE_ENV === "development";
		const imports: Record<string, string> = {
			react: "https://esm.sh/react@18.3.1",
			"react-dom": "https://esm.sh/react-dom@18.3.1",
			"react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
			"react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
			"react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
		};

		for (const [name, module] of this.registeredModules.entries()) {
			const framework = module.uiConfig.framework || "astro";

			if (framework === "stencil") {
				imports[`@${name}/loader`] = isDevelopment
					? `http://localhost:${this.port}/${name}/loader/index.js`
					: `/${name}/loader/index.js`;
				imports[`@${name}/dist`] = isDevelopment ? `http://localhost:${this.port}/${name}/dist/` : `/${name}/dist/`;
				imports[`@${name}/`] = isDevelopment ? `http://localhost:${this.port}/${name}/` : `/${name}/`;
			} else if (isDevelopment && module.uiConfig.devPort && (framework === "react" || framework === "vue")) {
				imports[`@${name}`] = `http://localhost:${module.uiConfig.devPort}/src/App.tsx`;
				imports[`@${name}/`] = `http://localhost:${module.uiConfig.devPort}/`;
			} else if (framework === "vite") {
				imports[`@${name}/`] = isDevelopment ? `http://localhost:${this.port}/${name}/` : `/${name}/`;
			} else if (framework === "react" || framework === "vue") {
				imports[`@${name}`] = `/${name}/App.js`;
				imports[`@${name}/`] = `/${name}/`;
			} else {
				imports[`@${name}`] = `/${name}/index.html`;
				imports[`@${name}/`] = `/${name}/`;
			}
		}

		return imports;
	}

	async #injectImportMapsInHTMLs(moduleName: string): Promise<void> {
		const module = this.registeredModules.get(moduleName);
		if (!module || !module.outputPath) return;

		const importMap = this.#generateCompleteImportMap();
		const importMapScript = `<script type="importmap">
${JSON.stringify({ imports: importMap }, null, 2)}
</script>`;

		await this.#processHTMLFiles(module.outputPath, async (htmlPath, content) => {
			if (content.includes('<script type="importmap">')) {
				content = content.replace(/<script type="importmap">[\s\S]*?<\/script>/, importMapScript);
			} else {
				content = content.replace("</head>", `${importMapScript}\n</head>`);
			}

			await fs.writeFile(htmlPath, content, "utf-8");
		});

		this.logger.logDebug(`Import maps inyectados en HTMLs de ${moduleName}`);
	}

	async #processHTMLFiles(dir: string, callback: (filePath: string, content: string) => Promise<void>): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				await this.#processHTMLFiles(fullPath, callback);
			} else if (entry.isFile() && entry.name.endsWith(".html")) {
				const content = await fs.readFile(fullPath, "utf-8");
				await callback(fullPath, content);
			}
		}
	}

	async #generateRspackConfig(module: RegisteredUIModule): Promise<string> {
		const isHost = module.uiConfig.name === "layout";
		const safeName = module.uiConfig.name.replace(/-/g, "_");
		const remotes: Record<string, string> = {};

		if (isHost) {
			for (const [moduleName, mod] of this.registeredModules.entries()) {
				if (moduleName !== "layout" && mod.uiConfig.devPort) {
					const framework = mod.uiConfig.framework || "react";
					if (framework === "react" || framework === "vue") {
						const safeRemoteName = moduleName.replace(/-/g, "_");
						remotes[moduleName] = `${safeRemoteName}@http://localhost:${mod.uiConfig.devPort}/mf-manifest.json`;
					}
				}
			}
		}

		// Use temp directory for config
		const configDir = path.resolve(process.cwd(), "temp", "configs", module.uiConfig.name);
		await fs.mkdir(configDir, { recursive: true });

		// Generar dinámicamente el contenido del fichero de configuración de Rspack
		const configContent = `
import * as path from 'node:path';
import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

// const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    context: '${module.appDir.replace(/\\/g, "\\\\")}',
    entry: {
        main: './src/main.tsx',
    },
    output: {
        path: '${path.join(this.uiOutputBaseDir, module.uiConfig.name).replace(/\\/g, "\\\\")}',
        publicPath: 'auto',
        uniqueName: '${safeName}',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
        alias: {
            '@ui-library/loader': '${path.resolve(this.uiOutputBaseDir, "ui-library", "loader").replace(/\\/g, "\\\\")}',
            '@ui-library/utils': '${path.resolve(this.uiOutputBaseDir, "ui-library", "utils").replace(/\\/g, "\\\\")}',
            '@ui-library': '${path.resolve(this.uiOutputBaseDir, "ui-library").replace(/\\/g, "\\\\")}',
        },
    },
    module: {
        rules: [
            {
                test: /\\.tsx?$/,
                use: {
                    loader: 'builtin:swc-loader',
                    options: {
                        jsc: {
                            parser: { syntax: 'typescript', tsx: true },
                            transform: { react: { runtime: 'automatic', development: true, refresh: false } },
                        },
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new rspack.HtmlRspackPlugin({
            template: './index.html',
        }),
        new ModuleFederationPlugin({
            name: '${safeName}',
            ${
				isHost
					? `remotes: ${JSON.stringify(remotes, null, 4)},`
					: `
            filename: 'remoteEntry.js',
            exposes: {
                './App': './src/App.tsx',
            },`
			}
            shared: {
                react: { singleton: true, requiredVersion: '^18.2.0', eager: true, strictVersion: false },
                'react-dom': { singleton: true, requiredVersion: '^18.2.0', eager: true, strictVersion: false },
                'react/jsx-dev-runtime': { singleton: true, eager: true, strictVersion: false },
            },
        }),
    ],
    devServer: {
        port: ${module.uiConfig.devPort},
        hot: true,
        historyApiFallback: true,
        static: {
            directory: '${path.join(module.appDir, "public").replace(/\\/g, "\\\\")}',
            publicPath: '/',
        },
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
        },
    },
    ignoreWarnings: [
        /Critical dependency.*expression/,
    ],
};
`;

		const configPath = path.join(configDir, "rspack.config.mjs");
		await fs.writeFile(configPath, configContent, "utf-8");
		this.logger.logDebug(`Generated Rspack config for ${module.uiConfig.name} at ${configPath}`);
		return configPath;
	}

	async #startRspackDevServer(module: RegisteredUIModule, rspackBin: string): Promise<void> {
		const configPath = await this.#generateRspackConfig(module);

		this.logger.logInfo(`Iniciando Rspack dev server para ${module.uiConfig.name} via spawn...`);

		// Setup log redirection
		const logsDir = path.resolve(process.cwd(), "temp", "logs");
		await fs.mkdir(logsDir, { recursive: true });
		const logFile = path.join(logsDir, `${module.uiConfig.name}.log`);

		// Add initial timestamp
		await fs.appendFile(logFile, `\n--- Start of Session: ${new Date().toISOString()} ---\n`);

		const spawnOptions: any = {
			cwd: module.appDir,
			stdio: "pipe",
			shell: false,
		};

		if (process.platform !== "win32") {
			spawnOptions.detached = true; // Crea un nuevo grupo de procesos
		}

		const watcher = spawn(rspackBin, ["serve", "--config", configPath], spawnOptions);

		watcher.stdout?.on("data", async (data) => {
			// Redirect stdout to log file
			try {
				await fs.appendFile(logFile, data);
			} catch (e) {
				// Silent fail if can't write log
			}
		});

		watcher.stderr?.on("data", async (data) => {
			// Redirect stderr to log file
			try {
				await fs.appendFile(logFile, data);
			} catch (e) {
				// Silent fail if can't write log
			}
		});

		watcher.on("error", (error) => {
			this.logger.logError(`Error en watcher de Rspack ${module.uiConfig.name}: ${error.message}`);
			module.buildStatus = "error";
			fs.appendFile(logFile, `[ERROR] Spawn error: ${error.message}\n`).catch(() => {});
		});

		watcher.on("exit", (code, signal) => {
			const exitMsg = `Rspack watcher terminated (code: ${code}, signal: ${signal})\n`;
			fs.appendFile(logFile, exitMsg).catch(() => {});

			if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL" && signal !== "SIGINT") {
				this.logger.logWarn(`Rspack watcher ${module.uiConfig.name} terminado inesperadamente. Ver logs en ${logFile}`);
				module.buildStatus = "error";
			} else {
				this.logger.logDebug(`Rspack watcher ${module.uiConfig.name} terminado (code: ${code}, signal: ${signal})`);
			}
		});

		this.watchBuilds.set(module.uiConfig.name, watcher);
		this.logger.logOk(`${module.uiConfig.name} Rspack Dev Server iniciado. Logs: temp/logs/${module.uiConfig.name}.log`);

		// Darle tiempo al servidor para que arranque antes de continuar
		await new Promise((resolve) => setTimeout(resolve, 5000));
		module.outputPath = undefined;
	}

	#updateImportMap(): void {
		this.importMap = { imports: this.#generateCompleteImportMap() };
		this.logger.logDebug(`Import map actualizado con ${Object.keys(this.importMap.imports).length} entradas`);
	}

	async #runCommand(command: string, args: string[], cwd: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const process = spawn(command, args, {
				cwd,
				stdio: "pipe",
				shell: false,
			});

			let output = "";
			let errorOutput = "";

			process.stdout?.on("data", (data) => {
				output += data.toString();
			});

			process.stderr?.on("data", (data) => {
				errorOutput += data.toString();
			});

			process.on("close", (code) => {
				if (code === 0) {
					if (output) {
						this.logger.logDebug(`Build output: ${output.slice(-200)}`);
					}
					resolve();
				} else {
					this.logger.logError(`Comando falló con código ${code}`);
					this.logger.logError(`Directorio: ${cwd}`);
					this.logger.logError(`Comando: ${command} ${args.join(" ")}`);
					if (output) {
						this.logger.logError(`Stdout: ${output.slice(0, 1000)}`);
					}
					if (errorOutput) {
						this.logger.logError(`Stderr: ${errorOutput.slice(0, 1000)}`);
					}
					reject(new Error(`Comando falló: ${command} ${args.join(" ")}`));
				}
			});

			process.on("error", (error) => {
				this.logger.logError(`Error ejecutando comando: ${error.message}`);
				reject(error);
			});
		});
	}

	async #copyDirectory(source: string, target: string): Promise<void> {
		await fs.mkdir(target, { recursive: true });

		const entries = await fs.readdir(source, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath = path.join(source, entry.name);
			const targetPath = path.join(target, entry.name);

			if (entry.isDirectory()) {
				await this.#copyDirectory(sourcePath, targetPath);
			} else {
				await fs.copyFile(sourcePath, targetPath);
			}
		}
	}
}

export type { IUIFederationService, RegisteredUIModule } from "./types.js";
