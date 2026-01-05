import type { ChildProcess } from "node:child_process";
import type { RegisteredUIModule } from "../types.js";
import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";

/**
 * Contexto de build pasado a las estrategias
 */
export interface IBuildContext {
	/** Módulo a construir */
	module: RegisteredUIModule;
	/** Namespace del módulo */
	namespace: string;
	/** Mapa de módulos registrados en el namespace */
	registeredModules: Map<string, RegisteredUIModule>;
	/** Directorio base de output UI */
	uiOutputBaseDir: string;
	/** Logger opcional */
	logger?: any;
	/** Indica si está en modo desarrollo */
	isDevelopment: boolean;
}

/**
 * Resultado de un build
 */
export interface IBuildResult {
	/** Proceso watcher (para dev servers) */
	watcher?: ChildProcess;
	/** Path del output generado */
	outputPath?: string;
}

/**
 * Tipo de bundler usado por la estrategia
 */
export type BundlerType = "rspack" | "vite" | "cli";

/**
 * Interface que deben implementar todas las estrategias de framework
 */
export interface IFrameworkStrategy {
	/** Nombre descriptivo de la estrategia */
	readonly name: string;
	/** Tipo de bundler que usa */
	readonly bundler: BundlerType;
	/** Framework base (react, vue, vanilla, astro, stencil) */
	readonly framework: string;

	/**
	 * Ejecuta el build del módulo
	 */
	build(context: IBuildContext): Promise<IBuildResult>;

	/**
	 * Genera la configuración del bundler
	 */
	generateConfig(context: IBuildContext): Promise<string>;

	/**
	 * Inicia el dev server
	 */
	startDevServer(context: IBuildContext): Promise<IBuildResult>;

	/**
	 * Realiza un build estático
	 */
	buildStatic(context: IBuildContext): Promise<IBuildResult>;

	/**
	 * Valida la configuración del módulo
	 */
	validateConfig(config: UIModuleConfig): void;

	/**
	 * Indica si la estrategia requiere devPort
	 */
	requiresDevPort(): boolean;
}
