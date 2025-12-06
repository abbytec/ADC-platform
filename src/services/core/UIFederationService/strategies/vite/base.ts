import * as path from "node:path";
import { build, type InlineConfig } from "vite";
import { BaseViteStrategy } from "../base-strategy.js";
import type { IBuildContext, IBuildResult } from "../types.js";
import { getDisabledAppsDetector } from "../../utils/disabled-apps-detector.js";
import aliasGenerator from "../../utils/alias-generator.js";
import { generateCompleteImportMap } from "../../utils/import-map.js";
import { copyPublicFiles } from "../../utils/file-operations.js";

/**
 * Clase base para estrategias Vite
 */
export abstract class ViteBaseStrategy extends BaseViteStrategy {
	protected readonly disabledAppsDetector = getDisabledAppsDetector();

	/**
	 * Genera la configuración de Vite (no escribe archivo, retorna objeto)
	 */
	async generateConfig(_context: IBuildContext): Promise<string> {
		// Vite no necesita escribir un archivo de config, usamos API programática
		return "vite-programmatic";
	}

	/**
	 * Obtiene la configuración de Vite como objeto
	 */
	protected async getViteConfig(context: IBuildContext, isDev: boolean): Promise<InlineConfig> {
		const { module, registeredModules, uiOutputBaseDir } = context;
		const config = module.uiConfig;
		const outputDir = path.join(uiOutputBaseDir, config.name);
		const base = isDev ? "/" : `/${config.name}/`;
		const devPort = config.devPort || 0;
		const isStandalone = config.standalone || false;

		const plugins = await this.getVitePlugins(context, isDev);

		// Generar aliases dinámicos
		const dynamicAliases = aliasGenerator.generate(registeredModules, uiOutputBaseDir, module);

		// Módulos federados para optimizeDeps.exclude
		const federatedModules: string[] = [];
		const externalModules: string[] = [];

		for (const moduleName of registeredModules.keys()) {
			federatedModules.push(`@${moduleName}`);
			externalModules.push(`@${moduleName}`);
			externalModules.push(moduleName);
			externalModules.push(`${moduleName}/App`);
			externalModules.push(`${moduleName}/App.js`);
		}

		// Agregar apps deshabilitadas a externals
		const disabledExternals = await this.disabledAppsDetector.getExternalsForDisabledApps(context.logger);
		for (const ext of disabledExternals) {
			externalModules.push(ext);
		}

		const externals: (string | RegExp)[] = isDev ? [] : externalModules;

		const buildConfig: any = {
			outDir: outputDir,
			emptyOutDir: true,
		};

		if (isStandalone) {
			buildConfig.rollupOptions = {
				input: path.resolve(module.appDir, "index.html"),
				external: externals,
				output: {
					globals: this.getGlobals(),
				},
			};
		} else {
			const appExtension = this.getFileExtension();
			buildConfig.lib = {
				entry: path.resolve(module.appDir, `src/App${appExtension}`),
				formats: ["es"],
				fileName: () => "App.js",
			};
			buildConfig.rollupOptions = {
				external: externals,
				output: {
					globals: this.getGlobals(),
				},
			};
		}

		return {
			configFile: false,
			root: module.appDir,
			base,
			plugins,
			resolve: {
				alias: dynamicAliases,
			},
			server: {
				port: devPort,
				strictPort: true,
				cors: {
					origin: "*",
					credentials: true,
				},
				hmr: {
					protocol: "ws",
					host: "localhost",
					port: devPort,
				},
			},
			optimizeDeps: {
				include: isDev ? this.getOptimizeDepsInclude() : [],
				exclude: federatedModules,
			},
			define: {
				"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
			},
			build: buildConfig,
		};
	}

	/**
	 * Inicia el dev server de Vite
	 */
	async startDevServer(context: IBuildContext): Promise<IBuildResult> {
		const { module, namespace, isDevelopment } = context;

		if (isDevelopment) {
			// En desarrollo: usar createServer con HMR
			const { createServer } = await import("vite");
			const viteConfig = await this.getViteConfig(context, true);

			context.logger?.logInfo(`Iniciando Vite Dev Server para ${module.uiConfig.name} [${namespace}]...`);

			const server = await createServer(viteConfig);
			await server.listen();

			const address = server.httpServer?.address();
			const port = typeof address === "object" && address ? address.port : module.uiConfig.devPort;

			context.logger?.logOk(`${module.uiConfig.name} [${namespace}] Vite Dev Server en http://localhost:${port}`);

			return {
				watcher: {
					kill: async () => {
						await server.close();
					},
				} as any,
				outputPath: undefined,
			};
		} else {
			// En producción: primero build, luego preview
			context.logger?.logInfo(`Build + Preview Vite para ${module.uiConfig.name} [${namespace}]...`);

			// Hacer el build primero
			const buildResult = await this.buildStatic(context);

			// Luego iniciar preview server
			const { preview } = await import("vite");
			const viteConfig = await this.getViteConfig(context, false);

			const previewServer = await preview({
				...viteConfig,
				preview: {
					port: module.uiConfig.devPort,
					strictPort: true,
					cors: true,
				},
			});

			context.logger?.logOk(`${module.uiConfig.name} [${namespace}] Vite Production Server en http://localhost:${module.uiConfig.devPort}`);

			return {
				watcher: {
					kill: async () => {
						await previewServer.close();
					},
				} as any,
				outputPath: buildResult.outputPath,
			};
		}
	}

	/**
	 * Build estático con Vite
	 */
	async buildStatic(context: IBuildContext): Promise<IBuildResult> {
		const { module, uiOutputBaseDir } = context;

		context.logger?.logInfo(`Ejecutando build Vite para ${module.uiConfig.name}...`);

		const viteConfig = await this.getViteConfig(context, false);
		await build(viteConfig);

		const outputPath = path.join(uiOutputBaseDir, module.uiConfig.name);
		module.outputPath = outputPath;

		// Copiar archivos públicos
		await copyPublicFiles(module.appDir, outputPath, context.logger);

		context.logger?.logOk(`Build completado para ${module.uiConfig.name}`);

		return { outputPath };
	}

	/**
	 * Obtiene los plugins de Vite
	 */
	protected abstract getVitePlugins(context: IBuildContext, isDev: boolean): Promise<any[]>;

	/**
	 * Obtiene las dependencias a incluir en optimizeDeps
	 */
	protected abstract getOptimizeDepsInclude(): string[];

	/**
	 * Obtiene los globals para rollup
	 */
	protected abstract getGlobals(): Record<string, string>;

	/**
	 * Crea plugin para inyectar import map (solo dev)
	 */
	protected createImportMapPlugin(context: IBuildContext): any {
		const { registeredModules } = context;
		const port = 3000; // Puerto del servidor principal

		return {
			name: "inject-importmap",
			transformIndexHtml: {
				order: "pre",
				handler(html: string) {
					const importMap = generateCompleteImportMap(registeredModules, port);

					const importMapScript = `    <script type="importmap">\n${JSON.stringify({ imports: importMap }, null, 6).replace(
						/\n/g,
						"\n    "
					)}\n    </script>`;

					if (html.includes("</head>")) {
						return html.replace("</head>", `${importMapScript}\n  </head>`);
					}
					return html;
				},
			},
		};
	}

	/**
	 * Crea plugin para resolver módulos federados (solo dev)
	 */
	protected createFederationResolverPlugin(context: IBuildContext): any {
		const { registeredModules } = context;
		const port = 3000;

		return {
			name: "federation-dev-resolver",
			enforce: "pre" as const,
			resolveId(source: string) {
				const federatedHosts: Record<string, string> = {};

				for (const [moduleName, module] of registeredModules.entries()) {
					if (module.uiConfig.devPort) {
						federatedHosts[`@${moduleName}/`] = `http://localhost:${module.uiConfig.devPort}/`;
					} else {
						federatedHosts[`@${moduleName}/`] = `http://localhost:${port}/${moduleName}/`;
					}
				}

				for (const prefix of Object.keys(federatedHosts)) {
					const moduleName = prefix.slice(1, -1);

					if (source === `@${moduleName}`) {
						const module = registeredModules.get(moduleName);
						const framework = module?.uiConfig.framework || "react";
						const appExtension = framework === "vue" ? ".vue" : ".tsx";
						return {
							id: `${federatedHosts[prefix]}src/App${appExtension}`,
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
		};
	}
}
