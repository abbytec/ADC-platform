// src/index.ts
import { Kernel } from './kernel.js';

async function main() {
  const kernel = new Kernel();
  await kernel.start();
  
  // --- Manejador de Ctrl+C para cierre ordenado ---
  process.on('SIGINT', async () => {
    await kernel.stop();
    process.exit(0);
  });
  
  console.log("---------------------------------------");
  console.log("[Main] Kernel en funcionamiento.");
  console.log("Puedes agregar/quitar carpetas en /apps para ver la carga dinámica.");
  console.log("Presiona Ctrl+C para salir.");
  console.log("---------------------------------------");
}

try {
  await main();
} catch (err) {
  console.error(err);
}