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
	process.on("SIGINT", async () => {
		await kernel.stop();
		process.exit(0);
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
