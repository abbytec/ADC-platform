// src/index.ts
import { Kernel } from "./kernel.js";
import { Logger } from "./utils/logger/Logger.js";

async function main() {
	const kernel = new Kernel();
	await kernel.start();

	// Reinyectar import maps ahora que todos los módulos UI están cargados
	try {
		const uiFederation = kernel.getService<any>("UIFederationService");
		if (uiFederation) {
			const uiFederationInstance = await uiFederation.getInstance();
			if (uiFederationInstance && typeof uiFederationInstance.refreshAllImportMaps === 'function') {
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

	// --- Manejador de Ctrl+C para cierre ordenado ---
	let isShuttingDown = false;
	const shutdownHandler = async () => {
		if (isShuttingDown) {
			Logger.warn("Cierre en progreso. Presiona Ctrl+C nuevamente para forzar la salida.");
			// Si presionan Ctrl+C por segunda vez, forzar salida
			process.on("SIGINT", () => {
				Logger.error("Forzando salida inmediata...");
				process.exit(1);
			});
			return;
		}
		isShuttingDown = true;

		// Timeout de 10 segundos para el cierre
		const shutdownTimeout = setTimeout(() => {
			Logger.error("Timeout en el cierre. Forzando salida...");
			process.exit(1);
		}, 10000);

		try {
			await kernel.stop();
			clearTimeout(shutdownTimeout);
			process.exit(0);
		} catch (error: any) {
			Logger.error(`Error durante el cierre: ${error.message}`);
			clearTimeout(shutdownTimeout);
			process.exit(1);
		}
	};

	process.on("SIGINT", shutdownHandler);
	process.on("SIGTERM", shutdownHandler);

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
