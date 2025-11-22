import * as path from "node:path";
import type { InlineConfig } from "vite";
import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";
import type { RegisteredUIModule } from "../types.js";
import { generateCompleteImportMap } from "../utils/import-map.js";

/**
 * Obtiene la configuración de Vite para un módulo
 */
export async function getViteConfig(
	appDir: string,
	config: UIModuleConfig,
	isDev: boolean,
	registeredModules: Map<string, RegisteredUIModule>,
	uiOutputBaseDir: string,
	port: number,
	logger?: any
): Promise<InlineConfig> {
	const framework = config.framework || "vanilla";
	const outputDir = path.join(uiOutputBaseDir, config.name);
	const base = isDev ? "/" : `/${config.name}/`;
	const devPort = config.devPort || 0;
	const isStandalone = config.standalone || false;

	const plugins = [];

	if (isDev) {
		// Plugin para inyectar import map
		plugins.push({
			name: "inject-importmap",
			transformIndexHtml: {
				order: "pre",
				handler(html: string) {
					const importMap = generateCompleteImportMap(registeredModules, port);
					const moduleCount = Object.keys(importMap).filter((k) => k.startsWith("@")).length;
					logger?.logDebug(`[${config.name}] Inyectando import map con ${moduleCount} módulos federados`);

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

		// Plugin para resolver módulos federados
		plugins.push({
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
					const moduleName = prefix.slice(1, -1); // Quitar @ y /

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
		} as any);
	}

	// Cargar plugins de framework
	if (framework === "react" || framework === "vue") {
		if (framework === "react") {
			const { default: react } = await import("@vitejs/plugin-react");
			plugins.push(react());
		} else if (framework === "vue") {
			try {
				const vueModule: any = await import("@vitejs/plugin-vue");
				const vue = vueModule.default;
				plugins.push(vue());
			} catch {
				logger?.logWarn(`[${config.name}] @vitejs/plugin-vue no instalado - ejecuta: npm install --save-dev @vitejs/plugin-vue`);
			}
		}

		const isLayout = config.name === "layout";

		if (!isLayout && isDev) {
			try {
				const federationModule: any = await import("@originjs/vite-plugin-federation");
				const federation = federationModule.default;

				logger?.logDebug(`[${config.name}] Configurando Vite como REMOTE (expone ./App)`);

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
				logger?.logWarn(`[${config.name}] Error configurando Vite MF: ${error.message}`);
			}
		}
	}

	const federatedModules: string[] = [];
	const externalModules: string[] = [];
	for (const moduleName of registeredModules.keys()) {
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
		const appExtension = framework === "vue" ? ".vue" : ".tsx";
		buildConfig.lib = {
			entry: path.resolve(appDir, `src/App${appExtension}`),
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
				"@ui-library/utils": path.resolve(process.cwd(), "src/apps/test/00-web-ui-library/utils"),
				"@ui-library/loader": path.resolve(uiOutputBaseDir, "web-ui-library", "loader"),
				"@ui-library": path.resolve(process.cwd(), "src/apps/test/00-web-ui-library/src"),
			},
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
			include: isDev ? ["react", "react-dom", "react-dom/client"] : [],
			exclude: federatedModules,
		},
		define: {
			"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
		},
		build: buildConfig,
	};
}
