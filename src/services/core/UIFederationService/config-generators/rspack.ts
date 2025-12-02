import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RegisteredUIModule } from "../types.js";
import { generateTailwindConfig, generatePostCSSConfig, hasTailwindEnabled } from "./tailwind.js";

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
	uiLibraryModule: RegisteredUIModule | null,
	uiOutputBaseDir: string,
	moduleConfig: RegisteredUIModule
): string {
	const aliases: Record<string, string> = {};
	
	if (uiLibraryModule) {
		const exports = uiLibraryModule.uiConfig.exports || {};
		
		for (const [exportName, exportPath] of Object.entries(exports)) {
			const aliasKey = `@ui-library/${exportName}`;
			
			if (exportName === "loader") {
				aliases[aliasKey] = path.resolve(uiOutputBaseDir, uiLibraryModule.name, exportPath).replace(/\\/g, "\\\\");
			} else {
				aliases[aliasKey] = path.resolve(uiLibraryModule.appDir, exportPath).replace(/\\/g, "\\\\");
			}
		}
		
		aliases["@ui-library"] = path.resolve(uiOutputBaseDir, uiLibraryModule.name).replace(/\\/g, "\\\\");
	}
	
	// Agregar @adc/utils si el módulo usa React (framework o sharedLibs)
	const usesReact = moduleConfig.uiConfig.framework === "react" || 
		(moduleConfig.uiConfig.sharedLibs && moduleConfig.uiConfig.sharedLibs.includes("react"));
	
	if (usesReact) {
		aliases["@adc/utils"] = path.resolve(process.cwd(), "src/utils").replace(/\\/g, "\\\\");
	}
	
	if (Object.keys(aliases).length === 0) {
		return "{}";
	}
	
	// Formatear como objeto JavaScript para el config
	const aliasEntries = Object.entries(aliases)
		.map(([key, value]) => `            '${key}': '${value}'`)
		.join(",\n");
	
	return `{\n${aliasEntries}\n        }`;
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
	const isHost = module.uiConfig.name.includes("layout");
	const hasI18n = module.uiConfig.i18n;
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
	const extensions = isVanilla ? "['.js', '.json', '.css']" : (isVue ? "['.vue', '.tsx', '.ts', '.jsx', '.js', '.json', '.css']" : "['.tsx', '.ts', '.jsx', '.js', '.json', '.css']");

	// Detectar si Tailwind está habilitado
	const tailwindEnabled = hasTailwindEnabled(module);
	let postcssConfigPath = "";
	
	if (tailwindEnabled) {
		logger?.logInfo(`[${module.uiConfig.name}] Tailwind CSS habilitado, generando configuración en temp/...`);
		const tailwindConfigPath = await generateTailwindConfig(module, registeredModules, configDir, logger);
		postcssConfigPath = await generatePostCSSConfig(tailwindConfigPath, configDir, logger);
	}

	let moduleRules = "";
	
	// Regla de CSS base (sin Tailwind)
	let cssRule = `
            {
                test: /\\.css$/,
                use: ['style-loader', 'css-loader'],
                type: 'javascript/auto',
            }`;
	
	// Si Tailwind está habilitado, usar PostCSS
	if (tailwindEnabled && postcssConfigPath) {
		cssRule = `
            {
                test: /\\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                config: '${postcssConfigPath.replace(/\\/g, "/")}',
                            },
                        },
                    },
                ],
                type: 'javascript/auto',
            }`;
	}
	
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
            },${cssRule}
    `;
	} else {
		moduleRules = `
            {
                test: /\\.js$/,
                exclude: /node_modules/,
                type: 'javascript/auto',
            },${cssRule}
    `;
	}

	// Inyectar adc-i18n.js solo en layouts
	const i18nScript = isHost && hasI18n ? `
            scriptLoading: 'blocking',
            inject: 'body',
            templateContent: ({ htmlWebpackPlugin }) => \`
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${module.uiConfig.name}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
    </style>
    <script src="/adc-i18n.js"></scr` + `ipt>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
\`,` : `
            template: './index.html',`;

	// Feature flags de Vue (requeridos para tree-shaking en producción)
	const vueFeatureFlags = usedFrameworks.has("vue") ? `
        new rspack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),` : "";

	let plugins = `${vueFeatureFlags}
        new rspack.HtmlRspackPlugin({${i18nScript}
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
                loader: 'vue-loader',
                options: {
                    compilerOptions: {
                        // Reconocer web components con prefijo "adc-"
                        isCustomElement: (tag) => tag.startsWith('adc-'),
                    },
                },
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
	for (const mod of registeredModules.values()) {
		if (mod.uiConfig.framework === "stencil" && mod.namespace === namespace) {
			uiLibraryModule = mod;
			break;
		}
	}
	
	// Generar aliases dinámicos basados en los exports de la ui-library y sharedLibs
	const aliasesObject = generateDynamicAliases(uiLibraryModule, uiOutputBaseDir, module);

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
        alias: ${aliasesObject},
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
        proxy: [
            {
                context: ['/adc-sw.js', '/adc-i18n.js', '/api/i18n'],
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        ],
    },
    ignoreWarnings: [
        /Critical dependency.*expression/,
    ],
    performance: {
        hints: ${isProduction ? "'warning'" : 'false'},
        maxAssetSize: 512000,      // 500 KiB
        maxEntrypointSize: 512000, // 500 KiB
    },
};
`;

	const configPath = path.join(configDir, "rspack.config.mjs");
	await fs.writeFile(configPath, configContent, "utf-8");
	logger?.logDebug(`Generated Rspack config for ${module.uiConfig.name} [${namespace}] at ${configPath}`);
	return configPath;
}
