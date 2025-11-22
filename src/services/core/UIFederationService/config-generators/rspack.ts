import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RegisteredUIModule } from "../types.js";

/**
 * Genera la configuración de Rspack para Module Federation
 */
export async function generateRspackConfig(
	module: RegisteredUIModule,
	registeredModules: Map<string, RegisteredUIModule>,
	uiOutputBaseDir: string,
	logger?: any
): Promise<string> {
	const isHost = module.uiConfig.name === "layout";
	const safeName = module.uiConfig.name.replace(/-/g, "_");
	const framework = module.uiConfig.framework || "react";
	const remotes: Record<string, string> = {};
	
	// Detectar frameworks usados por los remotes
	const usedFrameworks = new Set<string>();
	usedFrameworks.add(framework); // Agregar el framework del módulo actual
	
	// Agregar frameworks especificados manualmente en sharedLibs
	if (module.uiConfig.sharedLibs) {
		module.uiConfig.sharedLibs.forEach(lib => usedFrameworks.add(lib));
	}

	if (isHost) {
		for (const [moduleName, mod] of registeredModules.entries()) {
			if (moduleName !== "layout" && mod.uiConfig.devPort) {
				const remoteFramework = mod.uiConfig.framework || "react";
				if (remoteFramework === "react" || remoteFramework === "vue") {
					const safeRemoteName = moduleName.replace(/-/g, "_");
					remotes[moduleName] = `${safeRemoteName}@http://localhost:${mod.uiConfig.devPort}/mf-manifest.json`;
					usedFrameworks.add(remoteFramework);
				}
			}
		}
	}

	const configDir = path.resolve(process.cwd(), "temp", "configs", module.uiConfig.name);
	await fs.mkdir(configDir, { recursive: true });

	const isVue = framework === "vue";
	const mainEntry = isVue ? "./src/main.ts" : "./src/main.tsx";
	const appExtension = isVue ? ".vue" : ".tsx";
	const extensions = isVue ? "['.vue', '.tsx', '.ts', '.jsx', '.js', '.json']" : "['.tsx', '.ts', '.jsx', '.js', '.json']";

	let moduleRules = `
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
            }
    `;

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
		logger?.logInfo(`[${module.uiConfig.name}] Frameworks detectados: ${Array.from(usedFrameworks).join(", ")}`);
	}

	const configContent = `
${imports}

export default {
    mode: 'development',
    devtool: 'cheap-module-source-map',
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
            '@ui-library/loader': '${path.resolve(uiOutputBaseDir, "web-ui-library", "loader").replace(/\\/g, "\\\\")}',
            '@ui-library/utils': '${path.resolve(process.cwd(), "src/apps/test/00-web-ui-library/utils").replace(/\\/g, "\\\\")}',
            '@ui-library': '${path.resolve(uiOutputBaseDir, "web-ui-library").replace(/\\/g, "\\\\")}',
        },
    },
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
	logger?.logDebug(`Generated Rspack config for ${module.uiConfig.name} at ${configPath}`);
	return configPath;
}

