import { ChildProcess } from "node:child_process";
import { ImportMap, UIModuleConfig } from "../../../interfaces/modules/IUIModule.js";

/**
 * Información de un módulo UI registrado
 */
export interface RegisteredUIModule {
	/** Nombre del módulo (ej: "ui-library", "dashboard") */
	name: string;
	/** Namespace UI al que pertenece */
	namespace: string;
	/** Directorio de la app */
	appDir: string;
	/** Configuración del módulo UI */
	uiConfig: UIModuleConfig;
	/** Timestamp de registro */
	registeredAt: number;
	/** Estado del build */
	buildStatus: "pending" | "building" | "built" | "error";
	/** Path del build output */
	outputPath?: string;
	/** Proceso watcher del dev server (si aplica) */
	watcher?: ChildProcess;
}
