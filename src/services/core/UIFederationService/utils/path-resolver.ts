import * as path from "node:path";

const isDevelopment = process.env.NODE_ENV === "development";
export const outputBasePath = isDevelopment ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");

/** Obtiene el directorio de configuración para un módulo específico */
export const getConfigDir = (namespace: string, moduleName: string) => path.resolve(process.cwd(), "temp", "configs", namespace, moduleName);

/** Obtiene el directorio de logs */ //TODO: Reemplazar con LogManagerService
export const getLogsDir = () => path.resolve(process.cwd(), "temp", "logs");

/** Obtiene el path a un binario en node_modules/.bin */
export const getBinPath = (binary: string) => path.join(process.cwd(), "node_modules", ".bin", binary);

/** Normaliza un path para usarlo en configuraciones (escapa backslashes en Windows) */
export const normalizeForConfig = (filePath: string) => filePath.replace(/\\/g, "\\\\");
