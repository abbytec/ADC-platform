import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";

/**
 * Copia un directorio recursivamente
 */
export async function copyDirectory(source: string, target: string): Promise<void> {
	await fs.mkdir(target, { recursive: true });

	const entries = await fs.readdir(source, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);

		if (entry.isDirectory()) {
			await copyDirectory(sourcePath, targetPath);
		} else {
			await fs.copyFile(sourcePath, targetPath);
		}
	}
}

/**
 * Copia archivos públicos de una app al output
 */
export async function copyPublicFiles(appDir: string, outputDir: string, logger?: any): Promise<void> {
	const publicDir = path.join(appDir, "public");
	try {
		await fs.access(publicDir);
		const entries = await fs.readdir(publicDir);
		for (const entry of entries) {
			const sourcePath = path.join(publicDir, entry);
			const targetPath = path.join(outputDir, entry);
			await fs.copyFile(sourcePath, targetPath);
		}
		logger?.logDebug(`Archivos públicos copiados desde ${publicDir}`);
	} catch {
		logger?.logDebug(`No hay directorio public/ en ${appDir}`);
	}
}

/**
 * Ejecuta un comando en un directorio específico
 */
export async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	logger?: any
): Promise<void> {
	return new Promise((resolve, reject) => {
		const process = spawn(command, args, {
			cwd,
			stdio: "pipe",
			shell: false,
		});

		let output = "";
		let errorOutput = "";

		process.stdout?.on("data", (data) => {
			output += data.toString();
		});

		process.stderr?.on("data", (data) => {
			errorOutput += data.toString();
		});

		process.on("close", (code) => {
			if (code === 0) {
				if (output) {
					logger?.logDebug(`Build output: ${output.slice(-200)}`);
				}
				resolve();
			} else {
				logger?.logError(`Comando falló con código ${code}`);
				logger?.logError(`Directorio: ${cwd}`);
				logger?.logError(`Comando: ${command} ${args.join(" ")}`);
				if (output) {
					logger?.logError(`Stdout: ${output.slice(0, 1000)}`);
				}
				if (errorOutput) {
					logger?.logError(`Stderr: ${errorOutput.slice(0, 1000)}`);
				}
				reject(new Error(`Comando falló: ${command} ${args.join(" ")}`));
			}
		});

		process.on("error", (error) => {
			logger?.logError(`Error ejecutando comando: ${error.message}`);
			reject(error);
		});
	});
}

/**
 * Procesa recursivamente archivos HTML en un directorio
 * Si el directorio no existe, retorna silenciosamente (útil para dev servers que sirven desde memoria)
 */
export async function processHTMLFiles(
	dir: string,
	callback: (filePath: string, content: string) => Promise<void>
): Promise<void> {
	try {
		await fs.access(dir);
	} catch {
		// Directorio no existe (ej: dev server sirviendo desde memoria)
		return;
	}

	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			await processHTMLFiles(fullPath, callback);
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			const content = await fs.readFile(fullPath, "utf-8");
			await callback(fullPath, content);
		}
	}
}

