import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RegisteredUIModule } from "../types.js";

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
 * Genera la configuración de Rspack para Module Federation
 */
export async function generateRspackConfig(
	module: RegisteredUIModule,
	registeredModules: Map<string, RegisteredUIModule>,
	uiOutputBaseDir: string,
	logger?: any
): Promise<string> {
	const namespace = module.namespace || "default";
	const isHost = module.uiConfig.name === "layout";
	const safeName = module.uiConfig.name.replace(/-/g, "_");
	const framework = module.uiConfig.framework || "react";
	const remotes: Record<string, string> = {};
	const externals: string[] = [];
	
	// Detectar frameworks usados por los remotes
	const usedFrameworks = new Set<string>();
	if (framework !== "vanilla") {
		usedFrameworks.add(framework); // Agregar el framework del módulo actual solo si no es vanilla
	}
	
	// Agregar frameworks especificados manualmente en sharedLibs
	if (module.uiConfig.sharedLibs) {
		module.uiConfig.sharedLibs.forEach(lib => usedFrameworks.add(lib));
	}

	if (isHost) {
		// Detectar apps deshabilitadas
		const isDevelopment = process.env.NODE_ENV === "development";
		const appsBasePath = isDevelopment 
			? path.resolve(process.cwd(), "src", "apps", "test")
			: path.resolve(process.cwd(), "dist", "apps", "test");
		const disabledApps = await getDisabledApps(appsBasePath);
		
		// Agregar apps deshabilitadas como externals
		for (const disabledApp of disabledApps) {
			const appConfigPath = path.join(appsBasePath, disabledApp, "config.json");
			try {
				const configContent = await fs.readFile(appConfigPath, "utf-8");
				const config = JSON.parse(configContent);
				if (config.uiModule && config.uiModule.name) {
					externals.push(`${config.uiModule.name}/App`);
					logger?.logDebug(`[${module.uiConfig.name}] App deshabilitada agregada a externals: ${config.uiModule.name}`);
				}
			} catch {
				// Si no se puede leer el config, asumir que el nombre del módulo es el nombre de la carpeta
				externals.push(`${disabledApp}/App`);
			}
		}
		
		// Solo agregar remotes del mismo namespace
		for (const [moduleName, mod] of registeredModules.entries()) {
			const modNamespace = mod.namespace || "default";
			if (moduleName !== "layout" && mod.uiConfig.devPort && modNamespace === namespace) {
				const remoteFramework = mod.uiConfig.framework || "react";
				if (remoteFramework === "react" || remoteFramework === "vue" || remoteFramework === "vanilla") {
					const safeRemoteName = moduleName.replace(/-/g, "_");
					remotes[moduleName] = `${safeRemoteName}@http://localhost:${mod.uiConfig.devPort}/mf-manifest.json`;
					if (remoteFramework !== "vanilla") {
						usedFrameworks.add(remoteFramework);
					}
				}
			}
		}
	}

	const configDir = path.resolve(process.cwd(), "temp", "configs", namespace, module.uiConfig.name);
	await fs.mkdir(configDir, { recursive: true });

	const isVue = framework === "vue";
	const isVanilla = framework === "vanilla";
	const isProduction = process.env.NODE_ENV === "production";
	const isDevelopmentMode = !isProduction;
	const developmentValue = isDevelopmentMode ? 'true' : 'false'; // Como literal de JavaScript
	const mainEntry = isVanilla ? "./src/main.js" : (isVue ? "./src/main.ts" : "./src/main.tsx");
	const appExtension = isVanilla ? ".js" : (isVue ? ".vue" : ".tsx");
	const extensions = isVanilla ? "['.js', '.json']" : (isVue ? "['.vue', '.tsx', '.ts', '.jsx', '.js', '.json']" : "['.tsx', '.ts', '.jsx', '.js', '.json']");

	let moduleRules = "";
	
	if (!isVanilla) {
		moduleRules = `
            {
                test: /\\.tsx?$/,
                use: {
                    loader: 'builtin:swc-loader',
                    options: {
                        jsc: {
                            parser: { syntax: 'typescript', tsx: true },
                            transform: { react: { runtime: 'automatic', development: ${developmentValue}, refresh: false } },
                        },
                    },
                },
                exclude: /node_modules/,
            }
    `;
	} else {
		moduleRules = `
            {
                test: /\\.js$/,
                exclude: /node_modules/,
                type: 'javascript/auto',
            }
    `;
	}

	let plugins = `
        new rspack.HtmlRspackPlugin({
            template: './index.html',
        }),
    `;

	let imports = `
import * as path from 'node:path';
import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
    `;

	if (isVue) {
		imports += `
import { VueLoaderPlugin } from 'vue-loader';
      `;

		moduleRules += `,
            {
                test: /\\.vue$/,
                use: 'vue-loader',
                exclude: /node_modules/,
            },
            {
                test: /\\.css$/,
                use: ['style-loader', 'css-loader'],
            }
      `;
		plugins += `
        new VueLoaderPlugin(),
      `;
	}

	// Construir shared dinámicamente basado en frameworks usados
	const sharedLibs: string[] = [];
	
	if (usedFrameworks.has("react")) {
		sharedLibs.push(
			"react: { singleton: true, requiredVersion: '^18.2.0', eager: true, strictVersion: false }",
			"'react-dom': { singleton: true, requiredVersion: '^18.2.0', eager: true, strictVersion: false }",
			"'react/jsx-dev-runtime': { singleton: true, eager: true, strictVersion: false }"
		);
	}
	
	if (usedFrameworks.has("vue")) {
		sharedLibs.push("vue: { singleton: true, eager: true }");
	}
	
	// Agregar más frameworks aquí en el futuro (Angular, Svelte, etc.)
	// if (usedFrameworks.has("angular")) { ... }
	// if (usedFrameworks.has("svelte")) { ... }
	
	const shared = `{
        ${sharedLibs.join(",\n        ")}
    }`;
	
	if (isHost) {
		logger?.logInfo(`[${module.uiConfig.name}] [${namespace}] Frameworks detectados: ${Array.from(usedFrameworks).join(", ")}`);
	}

	// Configuración dinámica según modo (ya detectado arriba)
	const mode = isProduction ? 'production' : 'development';
	const devtool = isProduction ? 'false' : "'cheap-module-source-map'";
	const hotReload = !isProduction;

	// Buscar la ui-library específica del namespace
	let uiLibraryModule: RegisteredUIModule | null = null;
	for (const [modName, mod] of registeredModules.entries()) {
		if (mod.uiConfig.framework === "stencil" && mod.namespace === namespace) {
			uiLibraryModule = mod;
			break;
		}
	}
	
	// Paths para aliases basados en el módulo UI library encontrado
	const namespaceUiLibraryName = uiLibraryModule?.name || "web-ui-library";
	const namespaceUiLibraryLoaderPath = path.resolve(uiOutputBaseDir, namespaceUiLibraryName, "loader").replace(/\\/g, "\\\\");
	const namespaceUiLibraryPath = path.resolve(uiOutputBaseDir, namespaceUiLibraryName).replace(/\\/g, "\\\\");
	const namespaceUiLibraryUtilsPath = uiLibraryModule 
		? path.resolve(uiLibraryModule.appDir, "utils").replace(/\\/g, "\\\\")
		: path.resolve(process.cwd(), "src/apps/test/00-web-ui-library/utils").replace(/\\/g, "\\\\");

	const configContent = `
${imports}

export default {
    mode: '${mode}',
    devtool: ${devtool},
    context: '${module.appDir.replace(/\\/g, "\\\\")}',
    entry: {
        main: '${mainEntry}',
    },
    output: {
        path: '${path.join(uiOutputBaseDir, module.uiConfig.name).replace(/\\/g, "\\\\")}',
        publicPath: 'auto',
        uniqueName: '${safeName}',
    },
    resolve: {
        extensions: ${extensions},
        alias: {
            '@ui-library/loader': '${namespaceUiLibraryLoaderPath}',
            '@ui-library/utils': '${namespaceUiLibraryUtilsPath}',
            '@ui-library': '${namespaceUiLibraryPath}',
        },
    },${externals.length > 0 ? `
    externals: ${JSON.stringify(externals)},` : ''}
    module: {
        rules: [
            ${moduleRules}
        ],
    },
    plugins: [
        ${plugins}
        new ModuleFederationPlugin({
            name: '${safeName}',
            ${
							isHost
								? `remotes: ${JSON.stringify(remotes, null, 4)},`
								: `
            filename: 'remoteEntry.js',
            exposes: {
                './App': './src/App${appExtension}',
            },`
						}
            shared: ${shared},
        }),
    ],
    devServer: {
        port: ${module.uiConfig.devPort},
        hot: ${hotReload},
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
	logger?.logDebug(`Generated Rspack config for ${module.uiConfig.name} [${namespace}] at ${configPath}`);
	return configPath;
}
