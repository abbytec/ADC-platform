// src/index.ts
import { Kernel } from "./kernel.js";
import { Logger } from "./utils/logger/Logger.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Mata todos los procesos hijos del proceso actual
 */
async function killAllChildProcesses(): Promise<void> {
	const pid = process.pid;

	try {
		// En Linux/Unix, matar todos los procesos del grupo de procesos
		if (process.platform !== "win32") {
			// Primero intentar con SIGTERM
			try {
				await execAsync(`pkill -TERM -P ${pid}`);
				Logger.info("Enviando SIGTERM a procesos hijos...");
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} catch {
				// Ignorar si no hay procesos
			}

			// Luego forzar con SIGKILL
			try {
				await execAsync(`pkill -KILL -P ${pid}`);
				Logger.info("Enviando SIGKILL a procesos hijos restantes...");
			} catch {
				// Ignorar si no hay procesos
			}

			// Matar específicamente procesos de Stencil y Node workers
			try {
				await execAsync("pkill -9 -f 'stencil build --watch'");
				await execAsync("pkill -9 -f 'node_modules/@stencil/core/sys/node/worker.js'");
				Logger.info("Matando procesos de Stencil...");
			} catch {
				// Ignorar si no hay procesos
			}
		} else {
			// En Windows, usar taskkill
			try {
				await execAsync(`taskkill /F /T /PID ${pid}`);
			} catch {
				// Ignorar errores
			}
		}
	} catch (error: any) {
		Logger.debug(`Error matando procesos hijos: ${error.message}`);
	}
}

async function main() {
	const kernel = new Kernel();
	await kernel.start();

	// Reinyectar import maps ahora que todos los módulos UI están cargados
	try {
		const uiFederation = kernel.getService<any>("UIFederationService");
		if (uiFederation) {
			const uiFederationInstance = await uiFederation.getInstance();
			if (uiFederationInstance && typeof uiFederationInstance.refreshAllImportMaps === "function") {
				await uiFederationInstance.refreshAllImportMaps();
			} else {
				Logger.warn("refreshAllImportMaps no está disponible en UIFederationService");
			}
		} else {
			Logger.warn("UIFederationService no encontrado");
		}
	} catch (error: any) {
		Logger.error(`Error reinyectando import maps: ${error.message}`);
	}

	// --- Manejador de señales para cierre ordenado ---
	let isShuttingDown = false;
	let forceExitCount = 0;

	const shutdownHandler = async (signal: string) => {
		if (isShuttingDown) {
			forceExitCount++;
			if (forceExitCount >= 2) {
				Logger.error(`Forzando salida inmediata (${signal})...`);
				await killAllChildProcesses();
				process.exit(1);
			} else {
				Logger.warn(`Cierre en progreso. Presiona ${signal} nuevamente para forzar la salida.`);
			}
			return;
		}
		isShuttingDown = true;

		Logger.info(`\nSeñal ${signal} recibida. Iniciando cierre ordenado...`);

		// Timeout de 15 segundos para el cierre
		const shutdownTimeout = setTimeout(async () => {
			Logger.error("Timeout en el cierre. Matando todos los procesos hijos...");
			await killAllChildProcesses();
			process.exit(1);
		}, 15000);

		try {
			// 1. Intentar detener el kernel de forma ordenada
			try {
				Logger.info("Deteniendo el kernel...");
				await kernel.stop();
				Logger.ok("Kernel detenido correctamente.");
			} catch (kernelError: any) {
				Logger.error(`Error durante el stop del kernel (la limpieza forzosa continuará): ${kernelError.message}`);
			}

			// 2. Asegurar que todos los procesos hijos restantes mueran
			Logger.info("Ejecutando limpieza forzosa final...");
			await killAllChildProcesses();

			clearTimeout(shutdownTimeout);
			Logger.ok("Cierre completado exitosamente.");
			process.exit(0);
		} catch (error: any) {
			Logger.error(`Error durante el cierre: ${error.message}`);
			await killAllChildProcesses();
			clearTimeout(shutdownTimeout);
			process.exit(1);
		}
	};

	// Capturar múltiples señales
	process.on("SIGINT", () => shutdownHandler("SIGINT")); // Ctrl+C
	process.on("SIGTERM", () => shutdownHandler("SIGTERM")); // kill
	process.on("SIGHUP", () => shutdownHandler("SIGHUP")); // Terminal cerrada
	process.on("SIGQUIT", () => shutdownHandler("SIGQUIT")); // Ctrl+\

	// Manejar excepciones no capturadas
	process.on("uncaughtException", async (error) => {
		Logger.error(`Excepción no capturada: ${error.message}`);
		if (!isShuttingDown) {
			await shutdownHandler("UNCAUGHT_EXCEPTION");
		}
	});

	process.on("unhandledRejection", async (reason: any) => {
		Logger.error(`Promesa rechazada no manejada: ${reason?.message || reason}`);
		if (!isShuttingDown) {
			await shutdownHandler("UNHANDLED_REJECTION");
		}
	});

	Logger.ok("---------------------------------------");
	Logger.ok("Kernel en funcionamiento.");
	Logger.info("Puedes agregar/quitar carpetas en /apps para ver la carga dinámica.");
	Logger.info("Presiona Ctrl+C para salir.");
	Logger.ok("---------------------------------------");
}

try {
	await main();
} catch (err) {
	console.error(err);
}
