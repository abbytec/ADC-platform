import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { BaseCLIStrategy } from "../base-strategy.js";
import type { IBuildContext, IBuildResult } from "../types.js";
import { getBinPath } from "../../utils/path-resolver.js";
import { runCommand } from "../../utils/file-operations.js";

/**
 * Estrategia para Stencil (Web Components)
 */
export class StencilStrategy extends BaseCLIStrategy {
	readonly name = "Stencil";
	readonly framework = "stencil";

	protected getFileExtension(): string {
		return ".tsx";
	}

	protected getResolveExtensions(): string[] {
		return [".tsx", ".ts", ".jsx", ".js", ".json", ".css"];
	}

	/**
	 * Genera la configuración de Stencil
	 */
	async generateConfig(context: IBuildContext): Promise<string> {
		const { module, uiOutputBaseDir } = context;
		const namespaceOutputDir = path.join(uiOutputBaseDir);

		const namespace = module.uiConfig.uiNamespace || "default";
		const targetDir = path.join(namespaceOutputDir, module.uiConfig.name);
		const relativeOutputDir = path.relative(module.appDir, targetDir).replace(/\\/g, "/");

		// Cache de Stencil en temp/
		const cacheDir = path.resolve(process.cwd(), "temp", "stencil-cache", namespace, module.uiConfig.name);
		const relativeCacheDir = path.relative(module.appDir, cacheDir).replace(/\\/g, "/");

		// Asegurar que el directorio de cache existe
		await fs.mkdir(cacheDir, { recursive: true });

		const configContent = `import { Config } from '@stencil/core';

/**
 * Stencil config para ${module.uiConfig.name}
 * 
 * Generado automáticamente por UIFederationService.
 * Los componentes usan CSS puro (compatible con Shadow DOM).
 */
export const config: Config = {
	namespace: '${module.uiConfig.name}',
	cacheDir: '${relativeCacheDir}',
	outputTargets: [
		{
			type: 'dist',
			dir: '${relativeOutputDir}',
		},
		{
			type: 'dist-custom-elements',
			dir: '${relativeOutputDir}/custom-elements',
			customElementsExportBehavior: 'auto-define-custom-elements',
			externalRuntime: false,
		},
		{
			type: 'docs-readme',
		},
	],
	sourceMap: true,
	buildEs5: false,
};
`;

		// El stencil.config.ts debe estar en la app porque Stencil lo requiere ahí
		const configPath = path.join(module.appDir, "stencil.config.ts");
		await fs.writeFile(configPath, configContent, "utf-8");

		context.logger?.logDebug(`Stencil config generado para ${module.uiConfig.name} [${namespace}]`);
		return configPath;
	}

	/**
	 * Override: Stencil soporta watch mode en desarrollo
	 */
	protected shouldStartDevServer(context: IBuildContext): boolean {
		return context.isDevelopment;
	}

	/**
	 * Watch mode de Stencil
	 */
	async startDevServer(context: IBuildContext): Promise<IBuildResult> {
		const { module, uiOutputBaseDir, namespace } = context;
		const stencilBin = getBinPath("stencil");
		const outputDir = path.join(uiOutputBaseDir, module.uiConfig.name);

		await fs.mkdir(outputDir, { recursive: true });

		context.logger?.logDebug(`Iniciando Stencil build en watch mode para ${module.uiConfig.name} [${namespace}]`);

		// Generar config antes del watch
		await this.generateConfig(context);

		const watcher = spawn(stencilBin, ["build", "--watch"], {
			cwd: module.appDir,
			stdio: "pipe",
			shell: false,
			detached: process.platform !== "win32",
		});

		watcher.stdout?.on("data", (data: Buffer) => {
			const output = data.toString();
			if (output.includes("build finished")) {
				context.logger?.logDebug(`Stencil build actualizado para ${module.uiConfig.name} [${namespace}]`);
			}
		});

		watcher.stderr?.on("data", (data: Buffer) => {
			context.logger?.logDebug(`Stencil watch ${module.uiConfig.name}: ${data.toString().slice(0, 200)}`);
		});

		watcher.on("error", (error: Error) => {
			context.logger?.logError(`Error en watcher Stencil ${module.uiConfig.name}: ${error.message}`);
		});

		watcher.on("exit", (code, signal) => {
			context.logger?.logDebug(`Stencil watcher ${module.uiConfig.name} terminado (code: ${code}, signal: ${signal})`);
		});

		// Dar tiempo a que el build inicial termine
		await new Promise((resolve) => setTimeout(resolve, 5000));

		module.outputPath = outputDir;

		// Inyectar defineCustomElements en loader
		await this.injectDefineCustomElements(module, context.logger);

		return { watcher, outputPath: outputDir };
	}

	/**
	 * Build estático de Stencil
	 */
	async buildStatic(context: IBuildContext): Promise<IBuildResult> {
		const { module, uiOutputBaseDir, namespace } = context;
		const stencilBin = getBinPath("stencil");
		const outputDir = path.join(uiOutputBaseDir, module.uiConfig.name);

		await fs.mkdir(outputDir, { recursive: true });

		context.logger?.logInfo(`Ejecutando build Stencil para ${module.uiConfig.name} [${namespace}]...`);

		// Generar config antes del build
		await this.generateConfig(context);

		// Ejecutar build
		await runCommand(stencilBin, ["build"], module.appDir, context.logger);

		module.outputPath = outputDir;

		// Inyectar defineCustomElements en loader
		await this.injectDefineCustomElements(module, context.logger);

		context.logger?.logOk(`Build Stencil completado para ${module.uiConfig.name}`);

		return { outputPath: outputDir };
	}

	/**
	 * Inyecta defineCustomElements en el loader para auto-registro
	 */
	private async injectDefineCustomElements(module: any, logger?: any): Promise<void> {
		if (!module.outputPath) return;

		const loaderIndexPath = path.join(module.outputPath, "loader", "index.js");

		try {
			await fs.access(loaderIndexPath);
			let content = await fs.readFile(loaderIndexPath, "utf-8");

			if (!content.includes("defineCustomElements(window)")) {
				if (content.includes("export * from '../esm/loader.js';")) {
					content = content.replace(
						"export * from '../esm/loader.js';",
						`import { defineCustomElements } from '../esm/loader.js';\nexport * from '../esm/loader.js';\ndefineCustomElements(window);`
					);
				} else if (content.includes("export * from '../esm/loader.js'")) {
					content = content.replace(
						"export * from '../esm/loader.js'",
						`import { defineCustomElements } from '../esm/loader.js';\nexport * from '../esm/loader.js';\ndefineCustomElements(window);`
					);
				} else {
					content += `\nimport { defineCustomElements } from '../esm/loader.js';\ndefineCustomElements(window);`;
				}

				await fs.writeFile(loaderIndexPath, content, "utf-8");
				logger?.logDebug(`defineCustomElements inyectado en loader para ${module.uiConfig.name}`);
			}
		} catch {
			logger?.logWarn(`No se encontró loader/index.js para ${module.uiConfig.name}. El módulo podría no autocargarse.`);
		}
	}
}
