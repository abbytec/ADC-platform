// src/index.ts
import { Kernel } from "./kernel.js";
import UIFederationService from "./services/core/UIFederationService/index.ts";
import { Logger } from "./utils/logger/Logger.js";
import killAllChildProcesses from "./utils/system/KillChildProcesses.ts";

async function main() {
	const kernel = new Kernel();
	await kernel.start();

	// Reinyectar import maps ahora que todos los módulos UI están cargados
	try {
		const uiFederation = kernel.registry.getService<UIFederationService>("UIFederationService");
		if (uiFederation) {
			await uiFederation.refreshAllImportMaps();
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
