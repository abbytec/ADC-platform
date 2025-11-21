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
		plugin: "react()"
	},
	vue: {
		import: "import vue from '@vitejs/plugin-vue';",
		plugin: "vue()"
	}
};

export default class UIFederationService extends BaseService<IUIFederationService> {
	public readonly name = "UIFederationService";

	private readonly registeredModules = new Map<string, RegisteredUIModule>();
	private devServers = new Map<string, ViteDevServer>();
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
				language: "typescript"
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
		if (this.httpProvider) {
			await this.httpProvider.stop();
		}

		for (const server of this.devServers.values()) {
			await server.close();
		}
		this.devServers.clear();

		for (const watcher of this.watchBuilds.values()) {
			watcher.kill();
		}
		this.watchBuilds.clear();

		await super.stop();
	}

	async getInstance(): Promise<IUIFederationService> {
		return {
			registerUIModule: this.registerUIModule.bind(this),
			unregisterUIModule: this.unregisterUIModule.bind(this),
			getImportMap: this.getImportMap.bind(this),
			generateAstroConfig: this.generateAstroConfig.bind(this),
			buildUIModule: this.buildUIModule.bind(this),
			refreshAllImportMaps: this.refreshAllImportMaps.bind(this),
			getStats: this.getStats.bind(this),
		};
	}

	async registerUIModule(name: string, appDir: string, config: UIModuleConfig): Promise<void> {
		this.logger.logInfo(`Registrando módulo UI: ${name}`);

		const module: RegisteredUIModule = {
			name,
			appDir,
			config,
			registeredAt: Date.now(),
			buildStatus: "pending",
		};

		this.registeredModules.set(name, module);
		this.#updateImportMap();

		try {
			const framework = config.framework || "astro";
			const isDevelopment = process.env.NODE_ENV === "development";
			const isStandalone = config.standalone || false;

			if (isStandalone || (isDevelopment && config.devPort)) {
				await this.#generateStandaloneFiles(appDir, config);
			}

			if (framework === "astro") {
				const configPath = await this.generateAstroConfig(appDir, config);
				this.logger.logDebug(`Configuración de Astro generada: ${configPath}`);
			}

			if (isDevelopment && config.devPort && (framework === 'react' || framework === 'vue')) {
				await this.buildUIModule(name);
			} else {
				const shouldBuild = isStandalone || framework === "vite" || framework === "astro";

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
							await fs.copyFile(path.join(appDir, 'index.html'), path.join(targetOutputDir, 'index.html'));
						}
						
						await this.#copyDirectory(path.join(appDir, 'src'), path.join(targetOutputDir, 'src'));
						module.outputPath = targetOutputDir;
						module.buildStatus = "built";
						
						await this.#injectImportMapsInHTMLs(name);
					}
				} else {
					const targetOutputDir = path.join(this.uiOutputBaseDir, name);
					await fs.rm(targetOutputDir, { recursive: true, force: true });
					await this.#copyDirectory(path.join(appDir, 'src'), targetOutputDir);
					module.outputPath = targetOutputDir;
					module.buildStatus = "built";
				}
			}

			this.#updateImportMap();

			if (this.httpProvider && module.outputPath && !config.devPort) {
				const urlPath = `/${name}`;
				this.httpProvider.serveStatic(urlPath, module.outputPath);
				this.logger.logOk(`Módulo UI ${name} servido en http://localhost:${this.port}${urlPath}`);
			} else if (isDevelopment && config.devPort && (framework === 'react' || framework === 'vue')) {
				this.logger.logOk(`Módulo UI ${name} disponible SOLO en Dev Server http://localhost:${config.devPort}`);
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
					order: 'pre',
					handler(html: string) {
						const importMap = self.#generateCompleteImportMap();
						const moduleCount = Object.keys(importMap).filter(k => k.startsWith('@')).length;
						self.logger.logDebug(`[${config.name}] Inyectando import map con ${moduleCount} módulos federados`);
						
						const importMapScript = `    <script type="importmap">\n${JSON.stringify({ imports: importMap }, null, 6).replace(/\n/g, '\n    ')}\n    </script>`;
						const debugScript = `    <script>
      console.log('[UIFederation] Import map inyectado:', ${JSON.stringify(importMap)});
      console.log('[UIFederation] Módulos disponibles:', ${JSON.stringify(Object.keys(importMap).filter(k => k.startsWith('@')))});
    </script>`;
						
						if (html.includes('</head>')) {
							return html.replace('</head>', `${importMapScript}\n${debugScript}\n  </head>`);
						}
						return html;
					}
				}
			});

			plugins.push({
			name: "federation-dev-resolver",
			enforce: "pre" as const,
			resolveId(source: string) {
				const federatedHosts: Record<string, string> = {};
				for (const [moduleName, module] of registeredModules.entries()) {
					if (module.config.devPort) {
						federatedHosts[`@${moduleName}/`] = `http://localhost:${module.config.devPort}/`;
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
						
						if (module && module.config.framework === 'vite') {
							const withJs = remainder.endsWith('.js') ? remainder : `${remainder}.js`;
							return {
								id: `${federatedHosts[prefix]}${withJs}`,
								external: true,
							};
						} else {
							const withoutJs = remainder.replace(/\.js$/, '');
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

		if (framework === 'react' || framework === 'vue') {
		if (framework === 'react') {
			const { default: react } = await import('@vitejs/plugin-react');
			plugins.push(react());
		} else if (framework === 'vue') {
			try {
				// @ts-expect-error - Plugin de Vue opcional
				const vueModule: any = await import('@vitejs/plugin-vue');
					const vue = vueModule.default;
					plugins.push(vue());
				} catch {
					this.logger.logWarn(`[${config.name}] @vitejs/plugin-vue no instalado - ejecuta: npm install --save-dev @vitejs/plugin-vue`);
				}
		}

		const isLayout = config.name === 'layout';
		
		if (!isLayout && isDev) {
			try {
					const federationModule: any = await import('@originjs/vite-plugin-federation');
					const federation = federationModule.default;
					
					this.logger.logDebug(`[${config.name}] Configurando Vite como REMOTE (expone ./App)`);
					
					const mainExt = framework === 'react' ? '.tsx' : framework === 'vue' ? '.vue' : '.ts';
					
					plugins.push(federation({
						name: config.name,
						filename: 'remoteEntry.js',
						exposes: {
							'./App': `./src/App${mainExt}`,
						},
						shared: {
							react: { singleton: true, requiredVersion: '^18.2.0' },
							'react-dom': { singleton: true, requiredVersion: '^18.2.0' },
						}
					}) as any);
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
		externalModules.push(moduleName + '/App');
		externalModules.push(moduleName + '/App.js');
	}
	
	const externals: (string | RegExp)[] = isDev ? [] : externalModules;

		const buildConfig: any = {
			outDir: outputDir,
			emptyOutDir: true,
		};

	if (isStandalone) {
		buildConfig.rollupOptions = {
			input: path.resolve(appDir, 'index.html'),
			external: externals,
			output: {
				globals: { react: 'React', 'react-dom': 'ReactDOM' }
			}
		};
	} else {
		buildConfig.lib = {
			entry: path.resolve(appDir, 'src/App.tsx'), 
			formats: ['es'],
			fileName: () => 'App.js'
		};
		buildConfig.rollupOptions = {
			external: externals,
			output: {
				globals: { react: 'React', 'react-dom': 'ReactDOM' }
			}
		};
	}

		return {
			configFile: false,
			root: appDir,
			base: base,
			plugins,
			resolve: {
				alias: {
					'@ui-library': path.resolve(process.cwd(), 'src/apps/test/00-web-ui-library/src'),
				},
			},
			server: {
				port: port,
				strictPort: true,
			cors: {
				origin: '*',
				credentials: true,
			},
				hmr: {
					protocol: 'ws',
					host: 'localhost',
					port: port,
				},
			},
		optimizeDeps: {
			include: isDev ? ['react', 'react-dom', 'react-dom/client'] : [],
			exclude: federatedModules,
			},
			define: {
				'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
			},
			build: buildConfig
		};
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
			imports.join('\n'),
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
			configContentParts.push(`  integrations: [${integrations.join(', ')}],`);
		}

		configContentParts.push(`});`);
		
		const configContent = configContentParts.join('\n');

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
			const framework = module.config.framework || "astro";
			const rootDir = path.resolve(process.cwd());
			const viteBin = path.join(rootDir, "node_modules", ".bin", "vite");
			const astroBin = path.join(rootDir, "node_modules", ".bin", "astro");
			const isDevelopment = process.env.NODE_ENV === 'development';
			const isLayout = name === 'layout';

		if (framework === "react" || framework === "vue") {
			if (isDevelopment && module.config.devPort) {
				await this.#startRspackDevServer(module);
			} else {
				const viteConfig = await this.getViteConfig(module.appDir, module.config, false);
				this.logger.logDebug(`Iniciando build programático para ${name}`);
				await build(viteConfig);
				module.outputPath = path.join(this.uiOutputBaseDir, name);
			}
			} else if (framework === "vite") {
				const isDevelopment = process.env.NODE_ENV === 'development';
				
				if (isDevelopment) {
					this.logger.logDebug(`Iniciando Vite build en watch mode para ${name}`);
					const watcher = spawn(viteBin, ["build", "--watch"], {
						cwd: module.appDir,
						stdio: "pipe",
						shell: false,
					});
					
					watcher.stdout?.on("data", (data) => {
						const output = data.toString();
						if (output.includes("built in")) {
							this.logger.logDebug(`Vite build actualizado para ${name}`);
						}
					});
					
					watcher.stderr?.on("data", (data) => {
						this.logger.logDebug(`Vite watch ${name}: ${data.toString().slice(0, 200)}`);
					});
					
					this.watchBuilds.set(name, watcher);
					
					await new Promise((resolve) => setTimeout(resolve, 3000));
				} else {
					await this.#runCommand(viteBin, ["build"], module.appDir);
				}
				
				const sourceOutputDir = path.join(module.appDir, module.config.outputDir);
				const targetOutputDir = path.join(this.uiOutputBaseDir, name);
				await fs.rm(targetOutputDir, { recursive: true, force: true });
				await this.#copyDirectory(sourceOutputDir, targetOutputDir);
				module.outputPath = targetOutputDir;
			} else if (framework === "astro") {
				await this.#runCommand(astroBin, ["build"], module.appDir);
				
				const sourceOutputDir = path.join(module.appDir, module.config.outputDir);
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

	/**
	 * Genera el contenido de index.html para una app standalone
	 */
	#generateIndexHtml(config: UIModuleConfig): string {
		const framework = config.framework || "astro";
		const title = config.name.charAt(0).toUpperCase() + config.name.slice(1).replace(/-/g, ' ');
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
			if (layoutModule && layoutModule.config.devPort) {
				res.redirect(`http://localhost:${layoutModule.config.devPort}/`);
			}
		});

		this.logger.logDebug("Endpoints registrados: /importmap.json, /");
	}

	#generateCompleteImportMap(): Record<string, string> {
		const isDevelopment = process.env.NODE_ENV === 'development';
		const imports: Record<string, string> = {
			"react": "https://esm.sh/react@18.3.1",
			"react-dom": "https://esm.sh/react-dom@18.3.1",
			"react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
			"react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
			"react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
		};

		for (const [name, module] of this.registeredModules.entries()) {
			const framework = module.config.framework || "astro";
			
			if (isDevelopment && module.config.devPort && (framework === 'react' || framework === 'vue')) {
				imports[`@${name}`] = `http://localhost:${module.config.devPort}/src/App.tsx`;
				imports[`@${name}/`] = `http://localhost:${module.config.devPort}/`;
			} else if (framework === "vite") {
				imports[`@${name}/`] = isDevelopment 
					? `http://localhost:${this.port}/${name}/`
					: `/${name}/`;
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
				content = content.replace(
					/<script type="importmap">[\s\S]*?<\/script>/,
					importMapScript
				);
			} else {
				content = content.replace(
					'</head>',
					`${importMapScript}\n</head>`
				);
			}

			await fs.writeFile(htmlPath, content, 'utf-8');
		});

		this.logger.logDebug(`Import maps inyectados en HTMLs de ${moduleName}`);
	}

	async #processHTMLFiles(
		dir: string,
		callback: (filePath: string, content: string) => Promise<void>
	): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				await this.#processHTMLFiles(fullPath, callback);
			} else if (entry.isFile() && entry.name.endsWith('.html')) {
				const content = await fs.readFile(fullPath, 'utf-8');
				await callback(fullPath, content);
			}
		}
	}

	async #startRspackDevServer(module: RegisteredUIModule): Promise<void> {
		const { rspack } = await import('@rspack/core');
		const { ModuleFederationPlugin } = await import('@module-federation/enhanced/rspack');
		
		const isHost = module.config.name === 'layout';
		const safeName = module.config.name.replace(/-/g, '_');
		const remotes: Record<string, string> = {};
		if (isHost) {
			for (const [moduleName, mod] of this.registeredModules.entries()) {
				if (moduleName !== 'layout' && mod.config.devPort) {
					const framework = mod.config.framework || 'react';
					if (framework === 'react' || framework === 'vue') {
						const safeRemoteName = moduleName.replace(/-/g, '_');
						remotes[moduleName] = `${safeRemoteName}@http://localhost:${mod.config.devPort}/mf-manifest.json`;
					}
				}
			}
			this.logger.logDebug(`[${module.config.name}] Host Rspack remotes: ${Object.keys(remotes).join(', ')}`);
		} else {
			this.logger.logDebug(`[${module.config.name}] Remote Rspack (${safeName}) - expone ./App`);
		}

		const rspackConfig: any = {
			mode: 'development',
			devtool: 'cheap-module-source-map',
			context: module.appDir,
			entry: {
				main: './src/main.tsx',
			},
			output: {
				path: path.join(this.uiOutputBaseDir, module.config.name),
				publicPath: 'auto',
			},
		resolve: {
			extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
			alias: {
				'@ui-library': path.resolve(this.uiOutputBaseDir, 'ui-library'),
			},
		},
		module: {
				rules: [
					{
						test: /\.tsx?$/,
						use: {
							loader: 'builtin:swc-loader',
							options: {
								jsc: {
									parser: {
										syntax: 'typescript',
										tsx: true,
									},
							transform: {
								react: {
									runtime: 'automatic',
									development: true,
									refresh: false,
								},
							},
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
				name: safeName,
				...(isHost ? {
					remotes,
				} : {
					filename: 'remoteEntry.js',
					exposes: {
						'./App': './src/App.tsx',
					},
				}),
			shared: {
				react: { 
					singleton: true, 
					requiredVersion: '^18.2.0', 
					eager: true,
					strictVersion: false 
				},
				'react-dom': { 
					singleton: true, 
					requiredVersion: '^18.2.0', 
					eager: true,
					strictVersion: false 
				},
				'react/jsx-dev-runtime': { 
					singleton: true, 
					eager: true, 
					strictVersion: false 
				},
			},
			}),
		],
		devServer: {
			port: module.config.devPort,
			hot: true,
			historyApiFallback: true,
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

		const compiler = rspack(rspackConfig);
		const { RspackDevServer } = await import('@rspack/dev-server');
		const server = new RspackDevServer(rspackConfig.devServer, compiler);

		await server.start();
		
		this.devServers.set(module.config.name, server as any);
		
		this.logger.logOk(`${module.config.name} Rspack Dev Server con MF escuchando en http://localhost:${module.config.devPort}`);
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
