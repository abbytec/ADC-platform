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

/**
 * Interface del servicio UIFederation
 */
export interface IUIFederationService {
	/**
	 * Registra un módulo UI (llamado desde BaseApp)
	 */
	registerUIModule(name: string, appDir: string, config: UIModuleConfig): Promise<void>;

	/**
	 * Desregistra un módulo UI
	 */
	unregisterUIModule(name: string, namespace?: string): Promise<void>;

	/**
	 * Obtiene el import map actual
	 */
	getImportMap(): ImportMap;

	/**
	 * Ejecuta el build de un módulo UI
	 */
	buildUIModule(name: string, namespace?: string): Promise<void>;

	/**
	 * Reinyecta import maps en todos los módulos registrados
	 */
	refreshAllImportMaps(): Promise<void>;

	/**
	 * Obtiene estadísticas del servicio
	 */
	getStats(): {
		registeredModules: number;
		importMapEntries: number;
		modules: RegisteredUIModule[];
	};
}
