import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";
import type { IBuildContext, IBuildResult, IFrameworkStrategy, BundlerType } from "./types.js";

/**
 * Clase base abstracta para estrategias de framework.
 * Implementa el Template Method pattern para el proceso de build.
 */
export abstract class BaseFrameworkStrategy implements IFrameworkStrategy {
	abstract readonly name: string;
	abstract readonly bundler: BundlerType;
	abstract readonly framework: string;

	/**
	 * Template Method: proceso de build
	 * Orquesta la generación de config y ejecución del build
	 */
	async build(context: IBuildContext): Promise<IBuildResult> {
		// Validar configuración antes de proceder
		this.validateConfig(context.module.uiConfig);

		// Generar configuración (puede ser no-op para algunos frameworks)
		await this.generateConfig(context);

		// Decidir entre dev server o build estático
		if (this.shouldStartDevServer(context)) {
			return this.startDevServer(context);
		}

		return this.buildStatic(context);
	}

	/**
	 * Determina si debe iniciar un servidor (dev o prod)
	 * En producción local también se inicia el servidor para poder probar
	 */
	protected shouldStartDevServer(context: IBuildContext): boolean {
		return !!context.module.uiConfig.devPort;
	}

	/**
	 * Hooks abstractos que deben implementar las subclases
	 */
	abstract generateConfig(context: IBuildContext): Promise<string>;
	abstract startDevServer(context: IBuildContext): Promise<IBuildResult>;
	abstract buildStatic(context: IBuildContext): Promise<IBuildResult>;

	/**
	 * Validación por defecto: verifica devPort si es requerido
	 */
	validateConfig(config: UIModuleConfig): void {
		if (this.requiresDevPort() && !config.devPort) {
			throw new Error(
				`Framework "${this.name}" requiere devPort configurado. ` +
				`Por favor añade "devPort: <número>" en la configuración del módulo.`
			);
		}
	}

	/**
	 * Por defecto, frameworks con bundler requieren devPort
	 */
	requiresDevPort(): boolean {
		return this.bundler === "rspack" || this.bundler === "vite";
	}

	/**
	 * Obtiene el nombre safe para Module Federation (sin guiones)
	 */
	protected getSafeName(name: string): string {
		return name.replace(/-/g, "_");
	}

	/**
	 * Verifica si el módulo es un layout (shell app que carga remotes)
	 */
	protected isLayout(context: IBuildContext): boolean {
		return context.module.uiConfig.name.includes("layout");
	}

	/**
	 * Verifica si el módulo es un host (tiene index.html standalone)
	 */
	protected isHost(context: IBuildContext): boolean {
		return context.module.uiConfig.isHost ?? false;
	}

	/**
	 * Obtiene la extensión de archivo para el framework
	 */
	protected abstract getFileExtension(): string;

	/**
	 * Obtiene las extensiones de resolución para el framework
	 */
	protected abstract getResolveExtensions(): string[];

	/**
	 * Log helper
	 */
	protected log(context: IBuildContext, level: "info" | "debug" | "warn" | "error", message: string): void {
		const prefix = `[${this.name}] [${context.namespace}/${context.module.name}]`;
		const fullMessage = `${prefix} ${message}`;

		switch (level) {
			case "info":
				context.logger?.logInfo(fullMessage);
				break;
			case "debug":
				context.logger?.logDebug(fullMessage);
				break;
			case "warn":
				context.logger?.logWarn(fullMessage);
				break;
			case "error":
				context.logger?.logError(fullMessage);
				break;
		}
	}
}

/**
 * Clase base para estrategias Rspack
 */
export abstract class BaseRspackStrategy extends BaseFrameworkStrategy {
	readonly bundler: BundlerType = "rspack";

	requiresDevPort(): boolean {
		return true;
	}
}

/**
 * Clase base para estrategias Vite
 */
export abstract class BaseViteStrategy extends BaseFrameworkStrategy {
	readonly bundler: BundlerType = "vite";

	requiresDevPort(): boolean {
		return true;
	}
}

/**
 * Clase base para estrategias CLI (Astro, Stencil)
 */
export abstract class BaseCLIStrategy extends BaseFrameworkStrategy {
	readonly bundler: BundlerType = "cli";

	requiresDevPort(): boolean {
		return false;
	}

	/**
	 * Las estrategias CLI no inician dev server por defecto
	 */
	protected shouldStartDevServer(_context: IBuildContext): boolean {
		// Las estrategias CLI pueden tener watch mode pero no dev server HTTP
		return false;
	}
}
