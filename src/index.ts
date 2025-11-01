// src/index.ts
import { Kernel } from './kernel.js';
import { Logger } from './utils/Logger.js';

async function main() {
  const kernel = new Kernel();
  await kernel.start();
  
  // --- Manejador de Ctrl+C para cierre ordenado ---
  process.on('SIGINT', async () => {
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