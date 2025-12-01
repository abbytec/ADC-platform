import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { InlineConfig } from "vite";
import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";
import type { RegisteredUIModule } from "../types.js";
import { generateCompleteImportMap } from "../utils/import-map.js";

/**
 * Detecta apps deshabilitadas en el directorio de apps
 */
async function getDisabledApps(appsDir: string): Promise<Set<string>> {
	const disabledApps = new Set<string>();
	
	try {
		const entries = await fs.readdir(appsDir, { withFileTypes: true });
		
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const appDir = path.join(appsDir, entry.name);
				
				// Verificar default.json
				try {
					const defaultConfigPath = path.join(appDir, "default.json");
					const content = await fs.readFile(defaultConfigPath, "utf-8");
					const config = JSON.parse(content);
					if (config.disabled === true) {
						disabledApps.add(entry.name);
						continue;
					}
				} catch {
					// No hay default.json, continuar
				}
				
				// Verificar config.json
				try {
					const configPath = path.join(appDir, "config.json");
					const content = await fs.readFile(configPath, "utf-8");
					const config = JSON.parse(content);
					if (config.disabled === true || (config.uiModule && config.uiModule.disabled === true)) {
						disabledApps.add(entry.name);
					}
				} catch {
					// No hay config.json, continuar
				}
			}
		}
	} catch (error) {
		// Si no se puede leer el directorio, retornar set vacío
	}
	
	return disabledApps;
}

/**
 * Genera aliases dinámicos basados en los exports de la ui-library del namespace
 * y las utilidades del core según las sharedLibs del módulo
 */
function generateDynamicAliases(
	registeredModules: Map<string, RegisteredUIModule>,
	uiOutputBaseDir: string,
	namespace: string,
	moduleConfig: UIModuleConfig
): Record<string, string> {
	const aliases: Record<string, string> = {};
	
	// Buscar la ui-library del namespace (framework === "stencil")
	let uiLibraryModule: RegisteredUIModule | null = null;
	for (const mod of registeredModules.values()) {
		const modNamespace = mod.namespace || "default";
		if (mod.uiConfig.framework === "stencil" && modNamespace === namespace) {
			uiLibraryModule = mod;
			break;
		}
	}
	
	if (uiLibraryModule) {
		// Generar aliases basados en los exports definidos en el config de la ui-library
		const exports = uiLibraryModule.uiConfig.exports || {};
		
		for (const [exportName, exportPath] of Object.entries(exports)) {
			const aliasKey = `@ui-library/${exportName}`;
			
			if (exportName === "loader") {
				// El loader se genera en el output
				aliases[aliasKey] = path.resolve(uiOutputBaseDir, uiLibraryModule.name, exportPath);
			} else {
				// Otros exports (como utils) vienen del source
				aliases[aliasKey] = path.resolve(uiLibraryModule.appDir, exportPath);
			}
		}
		
		// Alias base @ui-library apunta al output compilado
		aliases["@ui-library"] = path.resolve(uiOutputBaseDir, uiLibraryModule.name);
	}
	
	// Agregar @adc/utils si el módulo usa React (framework o sharedLibs)
	const usesReact = moduleConfig.framework === "react" || 
		(moduleConfig.sharedLibs && moduleConfig.sharedLibs.includes("react"));
	
	if (usesReact) {
		aliases["@adc/utils"] = path.resolve(process.cwd(), "src/utils");
	}
	
	return aliases;
}

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
	const namespace = config.uiNamespace || "default";
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
	
	// Agregar apps deshabilitadas a externals
	const isProduction = process.env.NODE_ENV === "production";
	const appsBasePath = isProduction 
		? path.resolve(process.cwd(), "dist", "apps", "test")
		: path.resolve(process.cwd(), "src", "apps", "test");
	const disabledApps = await getDisabledApps(appsBasePath);
	
	for (const disabledApp of disabledApps) {
		const appConfigPath = path.join(appsBasePath, disabledApp, "config.json");
		try {
			const configContent = await fs.readFile(appConfigPath, "utf-8");
			const appConfig = JSON.parse(configContent);
			const moduleName = appConfig.uiModule?.name || disabledApp;
			externalModules.push(`@${moduleName}`);
			externalModules.push(moduleName);
			externalModules.push(moduleName + "/App");
			externalModules.push(moduleName + "/App.js");
			logger?.logDebug(`[${config.name}] App deshabilitada agregada a externals: ${moduleName}`);
		} catch {
			// Si no se puede leer el config, asumir que el nombre del módulo es el nombre de la carpeta
			externalModules.push(`@${disabledApp}`);
			externalModules.push(disabledApp);
			externalModules.push(disabledApp + "/App");
			externalModules.push(disabledApp + "/App.js");
		}
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

	// Generar aliases dinámicos basados en la ui-library del namespace y sharedLibs
	const dynamicAliases = generateDynamicAliases(registeredModules, uiOutputBaseDir, namespace, config);

	return {
		configFile: false,
		root: appDir,
		base: base,
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
			include: isDev ? ["react", "react-dom", "react-dom/client"] : [],
			exclude: federatedModules,
		},
		define: {
			"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
		},
		build: buildConfig,
	};
}
