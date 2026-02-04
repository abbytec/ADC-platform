import * as path from "node:path";
import * as os from "node:os";

/** Obtiene el directorio de configuración para un módulo específico */
export const getConfigDir = (namespace: string, moduleName: string) => path.resolve(process.cwd(), "temp", "configs", namespace, moduleName);

/** Obtiene el directorio de logs */ //TODO: Reemplazar con LogManagerService
export const getLogsDir = () => path.resolve(process.cwd(), "temp", "logs");

/** Obtiene el path a un binario en node_modules/.bin */
export const getBinPath = (binary: string) => path.join(process.cwd(), "node_modules", ".bin", binary);

/** Normaliza un path para usarlo en configuraciones (escapa backslashes en Windows) */
export const normalizeForConfig = (filePath: string) => filePath.replace(/\\/g, "\\\\");

/**
 * Obtiene el hostname/IP del servidor para URLs accesibles desde la red.
 * Prioridad:
 * 1. Variable de entorno ADC_HOST (permite override manual)
 * 2. Primera IP de red no-loopback (IPv4)
 * 3. Fallback a "localhost"
 */
export const getServerHost = (): string => {
	// Override manual via env var
	if (process.env.ADC_HOST) {
		return process.env.ADC_HOST;
	}

	// Buscar primera IP de red válida
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		const netInterface = interfaces[name];
		if (!netInterface) continue;

		for (const iface of netInterface) {
			// Solo IPv4, no internal (loopback)
			if (iface.family === "IPv4" && !iface.internal) {
				return iface.address;
			}
		}
	}

	return "localhost";
};
