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
            externalRuntime: true,
        },
		{
			type: "dist-types",
			dir: "${relativeOutputDir}/web-ui-library-mobile",
			typesDir: "types",
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

		// Asignar outputPath antes de iniciar el watcher (se usa en generateAutoInit)
		module.outputPath = outputDir;

		const watcher = spawn(stencilBin, ["build", "--watch"], {
			cwd: module.appDir,
			stdio: "pipe",
			shell: false,
			detached: process.platform !== "win32",
		});

		// Handler para regenerar auto-init después de cada rebuild
		watcher.stdout?.on("data", (data: Buffer) => {
			const output = data.toString();
			if (output.includes("build finished")) {
				context.logger?.logDebug(`Stencil build actualizado para ${module.uiConfig.name} [${namespace}]`);
				// Regenerar init.js y styles.css después de cada rebuild
				this.generateAutoInit(module, context.logger).catch((err) => {
					context.logger?.logDebug(`Error regenerando auto-init: ${err.message}`);
				});
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

		// Esperar a que el build inicial termine (máximo 30 segundos)
		const loaderPath = path.join(outputDir, "loader", "index.js");
		const maxWaitTime = 30000;
		const checkInterval = 500;
		let elapsed = 0;

		context.logger?.logDebug(`Esperando build inicial de Stencil para ${module.uiConfig.name}...`);

		while (elapsed < maxWaitTime) {
			try {
				await fs.access(loaderPath);
				context.logger?.logDebug(`Build inicial de Stencil completado para ${module.uiConfig.name}`);
				break;
			} catch {
				await new Promise((resolve) => setTimeout(resolve, checkInterval));
				elapsed += checkInterval;
			}
		}

		if (elapsed >= maxWaitTime) {
			context.logger?.logWarn(`Timeout esperando build de Stencil para ${module.uiConfig.name}. El loader podría no estar disponible.`);
		}

		// Generar archivos de auto-init (init.js + styles.css)
		await this.generateAutoInit(module, context.logger);

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

		// Generar archivos de auto-init (init.js + styles.css)
		await this.generateAutoInit(module, context.logger);

		context.logger?.logOk(`Build Stencil completado para ${module.uiConfig.name}`);

		return { outputPath: outputDir };
	}

	/**
	 * Genera archivos de auto-init para la UI library:
	 * - init.js: auto-ejecuta defineCustomElements al importarse
	 * - styles.css: CSS base copiado de la UI library
	 */
	private async generateAutoInit(module: any, logger?: any): Promise<void> {
		if (!module.outputPath) return;

		const outputDir = module.outputPath;
		const appDir = module.appDir;

		// init.js
		const initContent = `/**
 * Auto-init para ${module.uiConfig.name}
 */
import { defineCustomElements } from './loader/index.js';

if (typeof window !== 'undefined') defineCustomElements(window);

export * from './loader/index.js';
`;
		await fs.writeFile(path.join(outputDir, "init.js"), initContent, "utf-8");
		logger?.logDebug(`init.js generado para ${module.uiConfig.name}`);

		// CSS
		const possibleCssPaths = [
			path.join(appDir, "src/global/tailwind.css"),
			path.join(appDir, "src/styles/tailwind.css"),
			path.join(appDir, "src/global/styles.css"),
			path.join(appDir, "src/global/accessibility.css"),
		];

		const stylesPath = path.join(outputDir, "styles.css");
		let combinedCss = "";

		for (const cssPath of possibleCssPaths) {
			try {
				await fs.access(cssPath);

				const cssContent = await fs.readFile(cssPath, "utf-8");
				combinedCss += "\n/* ---- " + path.basename(cssPath) + " ---- */\n";
				combinedCss += this.extractPureCss(cssContent, module.uiConfig.name);

				logger?.logDebug(`CSS agregado desde: ${cssPath}`);
			} catch {
				// ignorar si no existe
			}
		}

		if (combinedCss.trim()) {
			await fs.writeFile(stylesPath, combinedCss, "utf-8");
			logger?.logDebug(`styles.css combinado generado para ${module.uiConfig.name}`);
		} else {
			await fs.writeFile(stylesPath, `/* ${module.uiConfig.name} - No CSS source found */\n`, "utf-8");
			logger?.logDebug(`styles.css placeholder creado para ${module.uiConfig.name}`);
		}
	}

	/**
	 * Extrae CSS puro removiendo directivas de Tailwind (@import "tailwindcss", @layer, @utility, etc.)
	 * Convierte @layer blocks a CSS puro y preserva variables CSS
	 */
	private extractPureCss(cssContent: string, moduleName: string): string {
		let result = `/**\n * CSS base para ${moduleName}\n * Generado automáticamente - CSS puro sin directivas de Tailwind\n */\n\n`;

		// Remover @import "tailwindcss" y similares
		let cleaned = cssContent.replace(/@import\s+["']tailwindcss["'];?\s*/g, "");

		// Extraer contenido de @layer base { ... }
		const layerBaseMatch = cleaned.match(/@layer\s+base\s*\{([\s\S]*?)\n\}/);
		if (layerBaseMatch) {
			result += `/* Base styles */\n${layerBaseMatch[1].trim()}\n\n`;
		}

		// Extraer contenido de @layer components { ... }
		const layerComponentsMatch = cleaned.match(/@layer\s+components\s*\{([\s\S]*?)\n\}/);
		if (layerComponentsMatch) {
			result += `/* Component styles */\n${layerComponentsMatch[1].trim()}\n\n`;
		}

		// Si no hay @layer, buscar CSS directo (variables :root, etc.)
		if (!layerBaseMatch && !layerComponentsMatch) {
			// Remover @utility blocks (son específicos de Tailwind)
			cleaned = cleaned.replace(/@utility\s+[\w-]+\s*\{[^}]*\}/g, "");
			// Remover @keyframes por ahora (las apps los definen)
			cleaned = cleaned.replace(/@keyframes\s+[\w-]+\s*\{[\s\S]*?\}\s*\}/g, "");
			// Usar el CSS restante
			result = cleaned.trim() || result;
		}

		return result;
	}
}
