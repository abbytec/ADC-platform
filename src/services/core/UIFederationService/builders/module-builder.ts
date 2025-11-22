import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { build } from "vite";
import type { RegisteredUIModule } from "../types.js";
import { getViteConfig } from "../config-generators/vite.js";
import { copyDirectory, copyPublicFiles, runCommand } from "../utils/file-operations.js";
import { generateRspackConfig } from "../config-generators/rspack.js";

/**
 * Inicia el dev server de Rspack
 */
export async function startRspackDevServer(
	module: RegisteredUIModule,
	rspackBin: string,
	registeredModules: Map<string, RegisteredUIModule>,
	uiOutputBaseDir: string,
	logger?: any
): Promise<any> {
	const configPath = await generateRspackConfig(module, registeredModules, uiOutputBaseDir, logger);

	logger?.logInfo(`Iniciando Rspack dev server para ${module.uiConfig.name} via spawn...`);

	// Setup log redirection
	const logsDir = path.resolve(process.cwd(), "temp", "logs");
	await fs.mkdir(logsDir, { recursive: true });
	const logFile = path.join(logsDir, `${module.uiConfig.name}.log`);

	// Add initial timestamp
	await fs.appendFile(logFile, `\n--- Start of Session: ${new Date().toISOString()} ---\n`);

	const spawnOptions: any = {
		cwd: module.appDir,
		stdio: "pipe",
		shell: false,
	};

	if (process.platform !== "win32") {
		spawnOptions.detached = true; // Crea un nuevo grupo de procesos
	}

	const watcher = spawn(rspackBin, ["serve", "--config", configPath], spawnOptions);

	watcher.stdout?.on("data", async (data) => {
		try {
			await fs.appendFile(logFile, data);
		} catch (e) {
			// Silent fail if can't write log
		}
	});

	watcher.stderr?.on("data", async (data) => {
		try {
			await fs.appendFile(logFile, data);
		} catch (e) {
			// Silent fail if can't write log
		}
	});

	watcher.on("error", (error) => {
		logger?.logError(`Error en watcher de Rspack ${module.uiConfig.name}: ${error.message}`);
		module.buildStatus = "error";
		fs.appendFile(logFile, `[ERROR] Spawn error: ${error.message}\n`).catch(() => {});
	});

	watcher.on("exit", (code, signal) => {
		const exitMsg = `Rspack watcher terminated (code: ${code}, signal: ${signal})\n`;
		fs.appendFile(logFile, exitMsg).catch(() => {});

		if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL" && signal !== "SIGINT") {
			logger?.logWarn(`Rspack watcher ${module.uiConfig.name} terminado inesperadamente. Ver logs en ${logFile}`);
			module.buildStatus = "error";
		} else {
			logger?.logDebug(`Rspack watcher ${module.uiConfig.name} terminado (code: ${code}, signal: ${signal})`);
		}
	});

	logger?.logOk(`${module.uiConfig.name} Rspack Dev Server iniciado. Logs: temp/logs/${module.uiConfig.name}.log`);

	// Darle tiempo al servidor para que arranque antes de continuar
	await new Promise((resolve) => setTimeout(resolve, 5000));
	module.outputPath = undefined;
	
	return watcher;
}

/**
 * Construye un módulo Stencil
 */
export async function buildStencilModule(
	module: RegisteredUIModule,
	stencilBin: string,
	uiOutputBaseDir: string,
	isDevelopment: boolean,
	logger?: any
): Promise<any> {
	if (isDevelopment) {
		logger?.logDebug(`Iniciando Stencil build en watch mode para ${module.uiConfig.name}`);

		const watcher = spawn(stencilBin, ["build", "--watch"], {
			cwd: module.appDir,
			stdio: "pipe",
			shell: false,
			detached: process.platform !== "win32",
		});

		watcher.stdout?.on("data", (data) => {
			const output = data.toString();
			if (output.includes("build finished")) {
				logger?.logDebug(`Stencil build actualizado para ${module.uiConfig.name}`);
			}
		});

		watcher.stderr?.on("data", (data) => logger?.logDebug(`Stencil watch ${module.uiConfig.name}: ${data.toString().slice(0, 200)}`));
		watcher.on("error", (error) => logger?.logError(`Error en watcher de Stencil ${module.uiConfig.name}: ${error.message}`));
		watcher.on("exit", (code, signal) =>
			logger?.logDebug(`Stencil watcher ${module.uiConfig.name} terminado (code: ${code}, signal: ${signal})`)
		);

		await new Promise((resolve) => setTimeout(resolve, 5000)); // Dar tiempo a que el build inicial termine
		
		module.outputPath = path.join(uiOutputBaseDir, module.uiConfig.name);

		// Inyectar defineCustomElements en loader
		await injectDefineCustomElements(module, logger);
		
		return watcher;
	} else {
		await runCommand(stencilBin, ["build"], module.appDir, logger);
		module.outputPath = path.join(uiOutputBaseDir, module.uiConfig.name);
		await injectDefineCustomElements(module, logger);
		return null;
	}
}

async function injectDefineCustomElements(module: RegisteredUIModule, logger?: any): Promise<void> {
	if (!module.outputPath) return;
	
	const loaderIndexPath = path.join(module.outputPath, "loader", "index.js");
	try {
		await fs.access(loaderIndexPath);
		let content = await fs.readFile(loaderIndexPath, "utf-8");

		if (!content.includes("defineCustomElements(window)")) {
			content = content.replace(
				"export * from '../esm/loader.js';",
				`import { defineCustomElements } from '../esm/loader.js';\nexport * from '../esm/loader.js';\ndefineCustomElements(window);`
			);
			await fs.writeFile(loaderIndexPath, content, "utf-8");
			logger?.logDebug(`defineCustomElements inyectado en loader para ${module.uiConfig.name}`);
		}
	} catch {
		logger?.logWarn(`No se encontró loader/index.js para ${module.uiConfig.name}. El módulo podría no autocargarse.`);
	}
}

/**
 * Construye un módulo Vite (JavaScript vanilla)
 */
export async function buildViteModule(
	module: RegisteredUIModule,
	viteBin: string,
	uiOutputBaseDir: string,
	isDevelopment: boolean,
	logger?: any
): Promise<any> {
	if (isDevelopment) {
		logger?.logDebug(`Iniciando Vite build en watch mode para ${module.uiConfig.name}`);

		const spawnOptions: any = {
			cwd: module.appDir,
			stdio: "pipe",
			shell: false,
			detached: process.platform !== "win32",
		};

		const watcher = spawn(viteBin, ["build", "--watch"], spawnOptions);

		watcher.stdout?.on("data", (data) => {
			const output = data.toString();
			if (output.includes("built in")) {
				logger?.logDebug(`Vite build actualizado para ${module.uiConfig.name}`);
			}
		});

		watcher.stderr?.on("data", (data) => {
			logger?.logDebug(`Vite watch ${module.uiConfig.name}: ${data.toString().slice(0, 200)}`);
		});

		watcher.on("error", (error) => {
			logger?.logError(`Error en watcher de Vite ${module.uiConfig.name}: ${error.message}`);
		});

		watcher.on("exit", (code, signal) => {
			logger?.logDebug(`Vite watcher ${module.uiConfig.name} terminado (code: ${code}, signal: ${signal})`);
		});

		await new Promise((resolve) => setTimeout(resolve, 3000));
		
		const sourceOutputDir = path.join(module.appDir, module.uiConfig.outputDir);
		const targetOutputDir = path.join(uiOutputBaseDir, module.uiConfig.name);
		await fs.rm(targetOutputDir, { recursive: true, force: true });
		await copyDirectory(sourceOutputDir, targetOutputDir);
		module.outputPath = targetOutputDir;
		
		return watcher;
	} else {
		await runCommand(viteBin, ["build"], module.appDir, logger);
		
		const sourceOutputDir = path.join(module.appDir, module.uiConfig.outputDir);
		const targetOutputDir = path.join(uiOutputBaseDir, module.uiConfig.name);
		await fs.rm(targetOutputDir, { recursive: true, force: true });
		await copyDirectory(sourceOutputDir, targetOutputDir);
		module.outputPath = targetOutputDir;
		return null;
	}
}

/**
 * Construye un módulo React/Vue con Vite
 */
export async function buildReactVueModule(
	module: RegisteredUIModule,
	registeredModules: Map<string, RegisteredUIModule>,
	uiOutputBaseDir: string,
	port: number,
	logger?: any
): Promise<void> {
	const viteConfig = await getViteConfig(
		module.appDir,
		module.uiConfig,
		false,
		registeredModules,
		uiOutputBaseDir,
		port,
		logger
	);
	logger?.logDebug(`Iniciando build programático para ${module.uiConfig.name}`);
	await build(viteConfig);
	const outputPath = path.join(uiOutputBaseDir, module.uiConfig.name);
	module.outputPath = outputPath;
	await copyPublicFiles(module.appDir, outputPath, logger);
}

/**
 * Construye un módulo Astro
 */
export async function buildAstroModule(
	module: RegisteredUIModule,
	astroBin: string,
	uiOutputBaseDir: string,
	logger?: any
): Promise<void> {
	await runCommand(astroBin, ["build"], module.appDir, logger);

	const sourceOutputDir = path.join(module.appDir, module.uiConfig.outputDir);
	const targetOutputDir = path.join(uiOutputBaseDir, module.uiConfig.name);
	await fs.rm(targetOutputDir, { recursive: true, force: true });
	await copyDirectory(sourceOutputDir, targetOutputDir);
	module.outputPath = targetOutputDir;
}

