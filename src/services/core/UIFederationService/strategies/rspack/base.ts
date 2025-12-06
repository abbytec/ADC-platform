import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { BaseRspackStrategy } from "../base-strategy.js";
import type { IBuildContext, IBuildResult } from "../types.js";
import { getConfigDir, getBinPath, getLogsDir, normalizeForConfig } from "../../utils/path-resolver.js";
import { getDisabledAppsDetector } from "../../utils/disabled-apps-detector.js";
import aliasGenerator from "../../utils/alias-generator.js";
import { generateTailwindConfig, generatePostCSSConfig, hasTailwindEnabled } from "../../config-generators/tailwind.js";

/**
 * Clase base para estrategias Rspack con lógica común de generación de config
 */
export abstract class RspackBaseStrategy extends BaseRspackStrategy {
	protected readonly disabledAppsDetector = getDisabledAppsDetector();

	/**
	 * Genera la configuración de Rspack
	 */
	async generateConfig(context: IBuildContext): Promise<string> {
		const { module, namespace, registeredModules, uiOutputBaseDir } = context;
		const configDir = getConfigDir(namespace, module.uiConfig.name);
		await fs.mkdir(configDir, { recursive: true });

		const isHost = this.isHost(context);
		const isProduction = process.env.NODE_ENV === "production";
		const safeName = this.getSafeName(module.uiConfig.name);

		// Detectar remotos y externals
		const remotes = isHost ? await this.detectRemotes(context) : {};
		const externals = isHost ? await this.disabledAppsDetector.getExternalsForDisabledApps(context.logger) : [];

		// Detectar frameworks usados
		const usedFrameworks = aliasGenerator.detectUsedFrameworks(registeredModules, module);

		// Generar aliases
		const aliasesObject = aliasGenerator.generateForRspack(registeredModules, uiOutputBaseDir, module);

		// Configurar Tailwind si está habilitado
		let postcssConfigPath = "";
		if (hasTailwindEnabled(module)) {
			context.logger?.logInfo(`[${module.uiConfig.name}] Tailwind CSS habilitado, generando configuración...`);
			const tailwindConfigPath = await generateTailwindConfig(module, registeredModules, configDir, context.logger);
			postcssConfigPath = await generatePostCSSConfig(tailwindConfigPath, configDir, context.logger);
		}

		// Generar contenido del config
		const configContent = this.buildConfigContent({
			context,
			safeName,
			isHost,
			isProduction,
			remotes,
			externals,
			usedFrameworks,
			aliasesObject,
			postcssConfigPath,
			configDir,
		});

		const configPath = path.join(configDir, "rspack.config.mjs");
		await fs.writeFile(configPath, configContent, "utf-8");
		context.logger?.logDebug(`Config Rspack generado: ${configPath}`);

		return configPath;
	}

	/**
	 * Inicia el dev server de Rspack
	 */
	async startDevServer(context: IBuildContext): Promise<IBuildResult> {
		const { module, namespace } = context;
		const configPath = await this.generateConfig(context);
		const rspackBin = getBinPath("rspack");

		const logName = `${namespace}-${module.uiConfig.name}`;
		context.logger?.logInfo(`Iniciando Rspack dev server para ${module.uiConfig.name} [${namespace}]...`);

		// Setup log redirection
		const logsDir = getLogsDir();
		await fs.mkdir(logsDir, { recursive: true });
		const logFile = path.join(logsDir, `${logName}.log`);
		await fs.appendFile(logFile, `\n--- Start of Session: ${new Date().toISOString()} ---\n`);

		const spawnOptions: any = {
			cwd: module.appDir,
			stdio: "pipe",
			shell: false,
		};

		if (process.platform !== "win32") {
			spawnOptions.detached = true;
		}

		const watcher = spawn(rspackBin, ["serve", "--config", configPath], spawnOptions);

		watcher.stdout?.on("data", async (data) => {
			try {
				await fs.appendFile(logFile, data);
			} catch {
				// Silent fail
			}
		});

		watcher.stderr?.on("data", async (data) => {
			try {
				await fs.appendFile(logFile, data);
			} catch {
				// Silent fail
			}
		});

		watcher.on("error", (error) => {
			context.logger?.logError(`Error en watcher Rspack ${module.uiConfig.name}: ${error.message}`);
			module.buildStatus = "error";
			fs.appendFile(logFile, `[ERROR] Spawn error: ${error.message}\n`).catch(() => {});
		});

		watcher.on("exit", (code, signal) => {
			const exitMsg = `Rspack watcher terminated (code: ${code}, signal: ${signal})\n`;
			fs.appendFile(logFile, exitMsg).catch(() => {});

			if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL" && signal !== "SIGINT") {
				context.logger?.logWarn(`Rspack watcher ${module.uiConfig.name} terminado inesperadamente. Ver logs: ${logFile}`);
				module.buildStatus = "error";
			}
		});

		context.logger?.logOk(`${module.uiConfig.name} [${namespace}] Rspack Dev Server iniciado. Logs: temp/logs/${logName}.log`);

		// Dar tiempo al servidor para arrancar
		await new Promise((resolve) => setTimeout(resolve, 5000));

		return { watcher, outputPath: undefined };
	}

	/**
	 * Build estático (no aplicable para rspack por defecto - requiere devPort)
	 */
	async buildStatic(context: IBuildContext): Promise<IBuildResult> {
		// Rspack strategies requieren devPort, pero podemos generar un build de producción
		const configPath = await this.generateConfig(context);
		const rspackBin = getBinPath("rspack");
		const outputPath = path.join(context.namespace, context.module.uiConfig.name);

		context.logger?.logInfo(`Ejecutando build de producción para ${context.module.uiConfig.name}...`);

		return new Promise((resolve, reject) => {
			const proc = spawn(rspackBin, ["build", "--config", configPath], {
				cwd: context.module.appDir,
				stdio: "pipe",
				shell: false,
			});

			let output = "";
			let errorOutput = "";

			proc.stdout?.on("data", (data) => {
				output += data.toString();
			});

			proc.stderr?.on("data", (data) => {
				errorOutput += data.toString();
			});

			proc.on("close", (code) => {
				if (code === 0) {
					context.logger?.logOk(`Build completado para ${context.module.uiConfig.name}`);
					resolve({ outputPath });
				} else {
					context.logger?.logError(`Build falló para ${context.module.uiConfig.name}`);
					context.logger?.logError(`Error: ${errorOutput.slice(0, 500)}`);
					reject(new Error(`Rspack build falló con código ${code}`));
				}
			});

			proc.on("error", (error) => {
				reject(error);
			});
		});
	}

	/**
	 * Detecta remotes para Module Federation (solo para hosts)
	 */
	protected async detectRemotes(context: IBuildContext): Promise<Record<string, string>> {
		const { namespace, registeredModules } = context;
		const remotes: Record<string, string> = {};

		for (const [moduleName, mod] of registeredModules.entries()) {
			const modNamespace = mod.namespace || "default";
			if (moduleName !== "layout" && mod.uiConfig.devPort && modNamespace === namespace) {
				const framework = mod.uiConfig.framework || "react";
				// Solo incluir frameworks soportados por rspack
				if (["react", "vue", "vanilla"].includes(framework)) {
					const safeRemoteName = this.getSafeName(moduleName);
					remotes[moduleName] = `${safeRemoteName}@http://localhost:${mod.uiConfig.devPort}/mf-manifest.json`;
				}
			}
		}

		return remotes;
	}

	/**
	 * Construye el contenido del archivo de configuración
	 */
	protected buildConfigContent(options: {
		context: IBuildContext;
		safeName: string;
		isHost: boolean;
		isProduction: boolean;
		remotes: Record<string, string>;
		externals: string[];
		usedFrameworks: Set<string>;
		aliasesObject: string;
		postcssConfigPath: string;
		configDir: string;
	}): string {
		const { context, safeName, isHost, isProduction, remotes, externals, usedFrameworks, aliasesObject, postcssConfigPath } = options;

		const { module, uiOutputBaseDir } = context;
		const mode = isProduction ? "production" : "development";
		const devtool = isProduction ? "false" : "'cheap-module-source-map'";
		const hotReload = !isProduction;

		// Obtener configuración específica del framework
		const mainEntry = this.getMainEntry();
		const appExtension = this.getFileExtension();
		const extensions = JSON.stringify(this.getResolveExtensions());
		const moduleRules = this.getModuleRules(isProduction, postcssConfigPath);
		const plugins = this.getPlugins(context, isHost, usedFrameworks);
		const imports = this.getImports();
		const shared = this.buildSharedConfig(usedFrameworks);

		// Remotes o exposes según sea host o remote
		const federationConfig = isHost
			? `remotes: ${JSON.stringify(remotes, null, 4)},`
			: `
            filename: 'remoteEntry.js',
            exposes: {
                './App': './src/App${appExtension}',
            },`;

		return `
${imports}

export default {
    mode: '${mode}',
    devtool: ${devtool},
    context: '${normalizeForConfig(module.appDir)}',
    entry: {
        main: '${mainEntry}',
    },
    output: {
        path: '${normalizeForConfig(path.join(uiOutputBaseDir, module.uiConfig.name))}',
        publicPath: 'auto',
        uniqueName: '${safeName}',
    },
    resolve: {
        extensions: ${extensions},
        alias: ${aliasesObject},
    },${
		externals.length > 0
			? `
    externals: ${JSON.stringify(externals)},`
			: ""
	}
    module: {
        rules: [
            ${moduleRules}
        ],
    },
    plugins: [
        ${plugins}
        new ModuleFederationPlugin({
            name: '${safeName}',
            ${federationConfig}
            shared: ${shared},
        }),
    ],
    devServer: {
        port: ${module.uiConfig.devPort},
        hot: ${hotReload},
        historyApiFallback: true,
        allowedHosts: 'all',
        static: {
            directory: '${normalizeForConfig(path.join(module.appDir, "public"))}',
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
        hints: ${isProduction ? "'warning'" : "false"},
        maxAssetSize: 512000,
        maxEntrypointSize: 512000,
    },
};
`;
	}

	/**
	 * Construye la configuración de shared libraries
	 */
	protected buildSharedConfig(usedFrameworks: Set<string>): string {
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

		return `{
        ${sharedLibs.join(",\n        ")}
    }`;
	}

	/**
	 * Template para i18n
	 */
	protected getI18nTemplate(moduleName: string): string {
		return (
			`
            scriptLoading: 'blocking',
            inject: 'body',
            templateContent: ({ htmlWebpackPlugin }) => \`
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${moduleName}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
    </style>
    <scr` +
			`ipt src="/adc-i18n.js"></scr` +
			`ipt>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
\`,`
		);
	}

	/**
	 * Métodos abstractos para configuración específica del framework
	 */
	protected abstract getMainEntry(): string;
	protected abstract getModuleRules(isProduction: boolean, postcssConfigPath: string): string;
	protected abstract getPlugins(context: IBuildContext, isHost: boolean, usedFrameworks: Set<string>): string;
	protected abstract getImports(): string;
}
