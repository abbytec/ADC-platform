import { ImportMap, UIModuleConfig } from "../../../interfaces/modules/IUIModule.js";

/**
 * Información de un módulo UI registrado
 */
export interface RegisteredUIModule {
	/** Nombre del módulo (ej: "ui-library", "dashboard") */
	name: string;
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
	unregisterUIModule(name: string): Promise<void>;

	/**
	 * Obtiene el import map actual
	 */
	getImportMap(): ImportMap;

	/**
	 * Genera el astro.config.mjs para una app
	 */
	generateAstroConfig(appDir: string, config: UIModuleConfig): Promise<string>;

	/**
	 * Genera el stencil.config.ts para una app
	 */
	generateStencilConfig(appDir: string, config: UIModuleConfig): Promise<string>;

	/**
	 * Ejecuta el build de Astro para una app
	 */
	buildUIModule(name: string): Promise<void>;

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

