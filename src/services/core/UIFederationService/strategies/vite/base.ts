import * as path from "node:path";
import * as fs from "node:fs";
import { build, type InlineConfig } from "vite";
import { BaseFrameworkStrategy } from "../base-strategy.js";
import type { BundlerType, IBuildContext, IBuildResult } from "../types.js";
import aliasGenerator from "../../utils/alias-generator.js";
import { generateCompleteImportMap } from "../../utils/import-map.js";
import { copyPublicFiles } from "../../utils/file-operations.js";
import { getServerHost } from "../../utils/path-resolver.js";

/**
 * Clase base para estrategias Vite
 */
export abstract class ViteBaseStrategy extends BaseFrameworkStrategy {
	readonly bundler: BundlerType = "vite";
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
		const isHost = config.isHost ?? false;

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

		const externals: (string | RegExp)[] = isDev ? [] : externalModules;

		const buildConfig: any = {
			outDir: outputDir,
			emptyOutDir: true,
		};

		if (isHost) {
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

		// Plugin para servir assets estáticos adicionales (uiDependencies)
		const staticAssetsPlugin = this.createStaticAssetsPlugin(context);
		if (staticAssetsPlugin) {
			plugins.push(staticAssetsPlugin);
		}

		return {
			configFile: false,
			root: module.appDir,
			base,
			publicDir: path.join(module.appDir, "public"), // /pub/ para el propio módulo
			plugins,
			resolve: {
				alias: dynamicAliases,
				extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
			},
			server: {
				host: true,
				port: devPort,
				strictPort: true,
				cors: {
					origin: "*",
					credentials: true,
				},
				hmr: {
					protocol: "ws",
					clientPort: devPort,
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
	 * Crea un plugin para servir assets estáticos de uiDependencies (UI libraries) en /ui/
	 */
	protected createStaticAssetsPlugin(context: IBuildContext): any {
		const { module, registeredModules } = context;
		const uiDependencies = module.uiConfig.uiDependencies || [];

		// Buscar UI libraries en las dependencias
		const uiLibraryDirs: string[] = [];
		for (const depName of uiDependencies) {
			const depModule = registeredModules.get(depName);
			if (depModule && depModule.uiConfig.framework === "stencil") {
				const publicDir = path.join(depModule.appDir, "public");
				if (fs.existsSync(publicDir)) {
					uiLibraryDirs.push(publicDir);
				}
			}
		}

		if (uiLibraryDirs.length === 0) return null;

		return {
			name: "serve-ui-library-assets",
			configureServer(server: any) {
				server.middlewares.use((req: any, res: any, next: any) => {
					// Solo interceptar rutas que empiecen con /ui/
					if (!req.url?.startsWith("/ui/")) {
						return next();
					}

					const relativePath = req.url.slice(4); // Quitar "/ui/"

					// Buscar el archivo en los directorios de UI libraries
					for (const dir of uiLibraryDirs) {
						const filePath = path.join(dir, relativePath);
						if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
							// Determinar content-type básico
							const ext = path.extname(filePath).toLowerCase();
							const contentTypes: Record<string, string> = {
								".webp": "image/webp",
								".png": "image/png",
								".jpg": "image/jpeg",
								".jpeg": "image/jpeg",
								".gif": "image/gif",
								".svg": "image/svg+xml",
								".ico": "image/x-icon",
								".woff": "font/woff",
								".woff2": "font/woff2",
								".ttf": "font/ttf",
								".css": "text/css",
								".js": "application/javascript",
								".json": "application/json",
							};
							const contentType = contentTypes[ext] || "application/octet-stream";

							res.setHeader("Content-Type", contentType);
							res.setHeader("Cache-Control", "public, max-age=31536000");
							fs.createReadStream(filePath).pipe(res);
							return;
						}
					}

					next();
				});
			},
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

			context.logger?.logOk(
				`${module.uiConfig.name} [${namespace}] Vite Production Server en http://localhost:${module.uiConfig.devPort}`
			);

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
		const serverHost = getServerHost();

		return {
			name: "federation-dev-resolver",
			enforce: "pre" as const,
			resolveId(source: string) {
				const federatedHosts: Record<string, string> = {};

				for (const [moduleName, module] of registeredModules.entries()) {
					if (module.uiConfig.devPort) {
						federatedHosts[`@${moduleName}/`] = `http://${serverHost}:${module.uiConfig.devPort}/`;
					} else {
						federatedHosts[`@${moduleName}/`] = `http://${serverHost}:${port}/${moduleName}/`;
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
