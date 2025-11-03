import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chokidar from "chokidar";
import { IKernel } from "./interfaces/IKernel.js";
import { IApp } from "./interfaces/modules/IApp.js";
import { IMiddleware } from "./interfaces/modules/IMiddleware.js";
import { IProvider } from "./interfaces/modules/IProvider.js";
import { IPreset } from "./interfaces/modules/IPreset.js";
import { Logger } from "./utils/Logger/Logger.js";
import { ModuleLoader } from "./loaders/ModuleLoader.js";
import { ILogger } from "./interfaces/utils/ILogger.js";
import { IModuleConfig } from "./interfaces/modules/IModule.js";

export class Kernel implements IKernel {
	private readonly logger: ILogger = Logger.getLogger("Kernel");

	// --- Registros por categoría ---
	private readonly providersRegistry = new Map<string, any>();
	private readonly middlewaresRegistry = new Map<string, any>();
	private readonly presetsRegistry = new Map<string, any>();
	private readonly appsRegistry = new Map<string, IApp>();

	private readonly providerNameMap = new Map<string, string[]>();
	private readonly middlewareNameMap = new Map<string, string[]>();
	private readonly presetNameMap = new Map<string, string[]>();

	private readonly providers = new Map<string, string>(); // filePath -> uniqueKey
	private readonly middlewares = new Map<string, string>(); // filePath -> uniqueKey
	private readonly presets = new Map<string, string>(); // filePath -> uniqueKey
	private readonly apps = new Map<string, IApp>();

	// --- Gestor de carga ---
	public static readonly moduleLoader = new ModuleLoader();

	// --- Determinación de entorno ---
	private readonly isDevelopment = process.env.NODE_ENV === "development";
	private readonly basePath = this.isDevelopment ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");
	private readonly fileExtension = this.isDevelopment ? ".ts" : ".js";

	// --- Rutas ---
	private readonly providersPath = path.resolve(this.basePath, "providers");
	private readonly middlewaresPath = path.resolve(this.basePath, "middlewares");
	private readonly presetsPath = path.resolve(this.basePath, "presets");
	private readonly appsPath = path.resolve(this.basePath, "apps");

	private getUniqueKey(name: string, config?: Record<string, any>): string {
		return `${name}:${JSON.stringify(config || {})}`;
	}

	// --- API Pública del Kernel ---
	public registerProvider<T>(name: string, instance: T, type: string | undefined, config: IModuleConfig): void {
		const nameUniqueKey = this.getUniqueKey(name, config.config);

		if (this.providersRegistry.has(nameUniqueKey)) {
			this.logger.logDebug(`Provider ${name} con la misma configuración ya ha sido registrado.`);
		} else {
			this.providersRegistry.set(nameUniqueKey, instance);

			if (!this.providerNameMap.has(name)) {
				this.providerNameMap.set(name, []);
			}
			const nameKeys = this.providerNameMap.get(name)!;
			nameKeys.push(nameUniqueKey);
			this.logger.logOk(`Provider registrado: ${name} (Total de instancias: ${nameKeys.length})`);
		}

		if (type && type !== name) {
			const typeUniqueKey = this.getUniqueKey(type, config.config);
			if (!this.providersRegistry.has(typeUniqueKey)) {
				this.providersRegistry.set(typeUniqueKey, instance);
			}

			if (!this.providerNameMap.has(type)) {
				this.providerNameMap.set(type, []);
			}
			const typeKeys = this.providerNameMap.get(type)!;
			if (!typeKeys.includes(typeUniqueKey)) {
				typeKeys.push(typeUniqueKey);
			}
		}
	}

	public getProvider<T>(name: string, config?: Record<string, any>): T {
		if (config) {
			const uniqueKey = this.getUniqueKey(name, config);
			const instance = this.providersRegistry.get(uniqueKey);
			if (!instance) {
				this.logger.logError(`Provider ${name} con la configuración especificada no encontrado.`);
				throw new Error(`Provider ${name} con la configuración especificada no encontrado.`);
			}
			return instance as T;
		}

		const keys = this.providerNameMap.get(name);
		if (!keys || keys.length === 0) {
			this.logger.logError(`Provider ${name} no encontrado.`);
			throw new Error(`Provider ${name} no encontrado.`);
		}

		if (keys.length > 1) {
			this.logger.logError(
				`Múltiples instancias de Provider ${name} encontradas. Por favor, especifique una configuración para desambiguar.`
			);
			throw new Error(`Múltiples instancias de Provider ${name} encontradas. Por favor, especifique una configuración para desambiguar.`);
		}

		return this.providersRegistry.get(keys[0]) as T;
	}

	public registerMiddleware<T>(name: string, instance: T, config: IModuleConfig): void {
		const uniqueKey = this.getUniqueKey(name, config.config);

		if (this.middlewaresRegistry.has(uniqueKey)) {
			this.logger.logDebug(`Middleware ${name} con la misma configuración ya ha sido registrado.`);
			return;
		}

		this.middlewaresRegistry.set(uniqueKey, instance);

		if (!this.middlewareNameMap.has(name)) {
			this.middlewareNameMap.set(name, []);
		}
		const keys = this.middlewareNameMap.get(name)!;
		keys.push(uniqueKey);

		this.logger.logOk(`Middleware registrado: ${name} (Total de instancias: ${keys.length})`);
	}

	public getMiddleware<T>(name: string, config?: Record<string, any>): T {
		if (config) {
			const uniqueKey = this.getUniqueKey(name, config);
			const instance = this.middlewaresRegistry.get(uniqueKey);
			if (!instance) {
				this.logger.logError(`Middleware ${name} con la configuración especificada no encontrado.`);
				throw new Error(`Middleware ${name} con la configuración especificada no encontrado.`);
			}
			return instance as T;
		}

		const keys = this.middlewareNameMap.get(name);
		if (!keys || keys.length === 0) {
			this.logger.logError(`Middleware ${name} no encontrado.`);
			throw new Error(`Middleware ${name} no encontrado.`);
		}

		if (keys.length > 1) {
			this.logger.logError(
				`Múltiples instancias de Middleware ${name} encontradas. Por favor, especifique una configuración para desambiguar.`
			);
			throw new Error(
				`Múltiples instancias de Middleware ${name} encontradas. Por favor, especifique una configuración para desambiguar.`
			);
		}

		return this.middlewaresRegistry.get(keys[0]) as T;
	}

	public registerPreset<T>(name: string, instance: T, config: IModuleConfig): void {
		const uniqueKey = this.getUniqueKey(name, config.config);

		if (this.presetsRegistry.has(uniqueKey)) {
			this.logger.logDebug(`Preset ${name} con la misma configuración ya ha sido registrado.`);
			return;
		}

		this.presetsRegistry.set(uniqueKey, instance);

		if (!this.presetNameMap.has(name)) {
			this.presetNameMap.set(name, []);
		}
		const keys = this.presetNameMap.get(name)!;
		keys.push(uniqueKey);

		this.logger.logOk(`Preset registrado: ${name} (Total de instancias: ${keys.length})`);
	}

	public getPreset<T>(name: string, config?: Record<string, any>): T {
		if (config) {
			const uniqueKey = this.getUniqueKey(name, config);
			const instance = this.presetsRegistry.get(uniqueKey);
			if (!instance) {
				this.logger.logError(`Preset ${name} con la configuración especificada no encontrado.`);
				throw new Error(`Preset ${name} con la configuración especificada no encontrado.`);
			}
			return instance as T;
		}

		const keys = this.presetNameMap.get(name);
		if (!keys || keys.length === 0) {
			this.logger.logError(`Preset ${name} no encontrado.`);
			throw new Error(`Preset ${name} no encontrado.`);
		}

		if (keys.length > 1) {
			this.logger.logError(
				`Múltiples instancias de Preset ${name} encontradas. Por favor, especifique una configuración para desambiguar.`
			);
			throw new Error(`Múltiples instancias de Preset ${name} encontradas. Por favor, especifique una configuración para desambiguar.`);
		}

		return this.presetsRegistry.get(keys[0]) as T;
	}

	public registerApp(name: string, instance: IApp): void {
		if (this.appsRegistry.has(name)) {
			this.logger.logDebug(`App '${name}' sobrescrita.`);
		}
		this.appsRegistry.set(name, instance);
		this.logger.logOk(`App registrada: ${name}`);
	}

	public getApp(name: string): IApp {
		const instance = this.appsRegistry.get(name);
		if (!instance) {
			this.logger.logError(`App '${name}' no encontrada.`);
			throw new Error(`App '${name}' no encontrada.`);
		}
		return instance;
	}

	// --- Lógica de Arranque ---
	public async start(): Promise<void> {
		this.logger.logInfo("Iniciando...");
		this.logger.logInfo(`Modo: ${this.isDevelopment ? "DESARROLLO" : "PRODUCCIÓN"}`);
		this.logger.logDebug(`Base path: ${this.basePath}`);

		// Solo cargar Apps (que cargarán sus propios módulos desde modules.json)
		await this.loadLayerRecursive(this.appsPath, this.loadApp.bind(this), ["BaseApp.ts"]);

		// Iniciar watchers para carga dinámica (solo en desarrollo)
		if (this.isDevelopment) {
			this.watchLayer(this.providersPath, this.loadProvider.bind(this), this.unloadProvider.bind(this));
			this.watchLayer(this.middlewaresPath, this.loadMiddleware.bind(this), this.unloadMiddleware.bind(this));
			this.watchLayer(this.presetsPath, this.loadPreset.bind(this), this.unloadPreset.bind(this));
			this.watchLayer(this.appsPath, this.loadApp.bind(this), this.unloadApp.bind(this), ["BaseApp.ts"]);
		}
	}

	/**
	 * Carga todos los providers de forma recursiva
	 * Usado por apps que lo necesiten
	 */
	public async loadAllProviders(): Promise<void> {
		await this.loadLayerRecursive(this.providersPath, this.loadProvider.bind(this));
	}

	/**
	 * Carga todos los middlewares de forma recursiva
	 * Usado por apps que lo necesiten
	 */
	public async loadAllMiddlewares(): Promise<void> {
		await this.loadLayerRecursive(this.middlewaresPath, this.loadMiddleware.bind(this));
	}

	/**
	 * Carga todos los presets de forma recursiva
	 * Usado por apps que lo necesiten
	 */
	public async loadAllPresets(): Promise<void> {
		await this.loadLayerRecursive(this.presetsPath, this.loadPreset.bind(this));
	}

	/**
	 * Carga un módulo específico de un tipo (provider, middleware o preset)
	 */
	public async loadModuleOfType(
		type: "provider" | "middleware" | "preset",
		moduleName: string,
		versionRange: string = "latest",
		language: string = "typescript"
	): Promise<void> {
		try {
			const config = { name: moduleName, version: versionRange, language };
			if (type === "provider") {
				const provider = await Kernel.moduleLoader.loadProvider(config);
				const instance = await provider.getInstance();
				this.registerProvider(provider.name, instance, provider.type, config);
			} else if (type === "middleware") {
				const middleware = await Kernel.moduleLoader.loadMiddleware(config);
				const instance = await middleware.getInstance();
				this.registerMiddleware(middleware.name, instance, config);
			} else if (type === "preset") {
				const preset = await Kernel.moduleLoader.loadPreset(config, this);
				if (preset.initialize) {
					await preset.initialize();
				}
				const instance = preset.getInstance();
				this.registerPreset(preset.name, instance, config);
			}
		} catch (error) {
			this.logger.logError(`Error cargando ${type} '${moduleName}': ${error}`);
		}
	}

	// --- Lógica de Cierre ---
	public async stop(): Promise<void> {
		this.logger.logInfo("\nIniciando cierre ordenado...");

		// 1. Detener Apps
		this.logger.logInfo("Deteniendo apps...");
		for (const [, app] of this.apps) {
			try {
				this.logger.logDebug(`Deteniendo app ${app.name}`);
				await app.stop?.();
			} catch (e) {
				this.logger.logError(`Error deteniendo app ${app.name}: ${e}`);
			}
		}

		// 2. Detener Presets
		this.logger.logInfo("Deteniendo presets...");
		for (const key of this.presetsRegistry.keys()) {
			const preset = this.presetsRegistry.get(key) as IPreset<any>;
			try {
				await preset.shutdown?.();
			} catch (e) {
				this.logger.logError(`Error deteniendo preset ${preset.name}: ${e}`);
			}
		}

		// 3. Detener Middlewares
		this.logger.logInfo("Deteniendo middlewares...");
		for (const key of this.middlewaresRegistry.keys()) {
			const middleware = this.middlewaresRegistry.get(key) as IMiddleware<any>;
			try {
				await middleware.shutdown?.();
			} catch (e) {
				this.logger.logError(`Error deteniendo middleware ${middleware.name}: ${e}`);
			}
		}

		// 4. Detener Providers
		this.logger.logInfo("Deteniendo providers...");
		for (const key of this.providersRegistry.keys()) {
			const provider = this.providersRegistry.get(key) as IProvider<any>;
			try {
				await provider.shutdown?.();
			} catch (e) {
				this.logger.logError(`Error deteniendo provider ${provider.name}: ${e}`);
			}
		}

		this.logger.logOk("Cierre completado.");
	}

	/**
	 * Búsqueda recursiva ilimitada de todos los 'index.ts'/'index.js' en una capa.
	 */
	private async loadLayerRecursive(dir: string, loader: (entryPath: string) => Promise<void>, exclude: string[] = []): Promise<void> {
		try {
			// Primero, buscar si el mismo directorio tiene index
			const indexPath = path.join(dir, `index${this.fileExtension}`);
			try {
				if ((await fs.stat(indexPath)).isFile()) {
					await loader(indexPath);
					return; // Si encontramos index aquí, no buscar más
				}
			} catch {
				// No hay index en este nivel, continuar
			}

			// Luego, buscar recursivamente en subdirectorios
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (exclude.includes(entry.name)) continue;

				if (entry.isDirectory()) {
					const subDirPath = path.join(dir, entry.name);
					await this.loadLayerRecursive(subDirPath, loader, exclude);
				}
			}
		} catch {
			// El directorio no existe o no se puede leer, ignorar
		}
	}

	private async loadProvider(filePath: string): Promise<void> {
		try {
			const modulePath = path.dirname(filePath);
			let config = Kernel.moduleLoader.getConfigByPath(modulePath);
			if (!config) {
				const moduleName = path.basename(modulePath);
				config = { name: moduleName };
			}

			const provider = await Kernel.moduleLoader.loadProvider(config);
			const instance = await provider.getInstance();

			this.registerProvider(provider.name, instance, provider.type, config);
			const uniqueKey = this.getUniqueKey(provider.name, config.config);
			this.providers.set(filePath, uniqueKey);
		} catch (e) {
			this.logger.logError(`Error cargando Provider ${filePath}: ${e}`);
		}
	}

	private async loadMiddleware(filePath: string): Promise<void> {
		try {
			const modulePath = path.dirname(filePath);
			let config = Kernel.moduleLoader.getConfigByPath(modulePath);
			if (!config) {
				const moduleName = path.basename(modulePath);
				config = { name: moduleName };
			}

			const middleware = await Kernel.moduleLoader.loadMiddleware(config);
			const instance = await middleware.getInstance();

			this.registerMiddleware(middleware.name, instance, config);
			const uniqueKey = this.getUniqueKey(middleware.name, config.config);
			this.middlewares.set(filePath, uniqueKey);
		} catch (e) {
			this.logger.logError(`Error cargando Middleware ${filePath}: ${e}`);
		}
	}

	private async loadPreset(filePath: string): Promise<void> {
		try {
			const modulePath = path.dirname(filePath);
			let config = Kernel.moduleLoader.getConfigByPath(modulePath);
			if (!config) {
				const moduleName = path.basename(modulePath);
				config = { name: moduleName };
			}

			const preset = await Kernel.moduleLoader.loadPreset(config, this);
			if (preset.initialize) {
				await preset.initialize();
			}

			const instance = preset.getInstance();
			this.registerPreset(preset.name, instance, config);
			const uniqueKey = this.getUniqueKey(preset.name, config.config);
			this.presets.set(filePath, uniqueKey);
		} catch (e) {
			this.logger.logError(`Error cargando Preset ${filePath}: ${e}`);
		}
	}

	private async loadApp(filePath: string): Promise<void> {
		try {
			const module = await import(`${filePath}?v=${Date.now()}`);
			const AppClass = module.default;
			if (!AppClass) return;

			const appDir = path.dirname(filePath);
			const appName = path.basename(appDir);

			const configDirs = [appDir, path.join(appDir, "configs")];
			const allConfigFiles: string[] = [];

			for (const dir of configDirs) {
				try {
					const files = await fs.readdir(dir);
					files
						.filter((file) => file.endsWith(".json") && file !== "modules.json")
						.forEach((file) => allConfigFiles.push(path.join(dir, file)));
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
						this.logger.logWarn(`No se pudo leer el directorio de configuración ${dir}: ${error}`);
					}
				}
			}

			if (allConfigFiles.length > 0) {
				for (const configPath of allConfigFiles) {
					const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
					const configFile = path.basename(configPath);
					const configNameRaw = path.basename(configFile, ".json");
					const configName =
						configNameRaw === "config"
							? "default"
							: configNameRaw.startsWith("config-")
							? configNameRaw.substring("config-".length)
							: configNameRaw;
					const instanceName = `${appName}:${configName}`;

					const app: IApp = new AppClass(this, instanceName, config);
					this.registerApp(instanceName, app);
					this.logger.logDebug(`Inicializando App ${app.name}`);
					await app.loadModulesFromConfig();
					await app.start?.();
					const appKey = `${filePath}:${instanceName}`;
					this.apps.set(appKey, app);
					this.logger.logDebug(`Ejecutando App ${app.name}`);
					await app.run();
				}
			} else {
				const app: IApp = new AppClass(this, appName);
				this.registerApp(appName, app);
				this.logger.logDebug(`Inicializando App ${app.name}`);
				await app.loadModulesFromConfig();
				await app.start?.();
				this.apps.set(filePath, app);
				this.logger.logDebug(`Ejecutando App ${app.name}`);
				await app.run();
			}
		} catch (e) {
			this.logger.logError(`Error ejecutando App ${filePath}: ${e}`);
		}
	}

	// --- Lógica de Watchers y Descarga ---
	private watchLayer(dir: string, loader: (p: string) => Promise<void>, unloader: (p: string) => Promise<void>, exclude: string[] = []) {
		const watcher = chokidar.watch(path.join(dir, `**/index${this.fileExtension}`), {
			ignoreInitial: true,
			ignored: exclude,
		});
		watcher.on("add", (p) => loader(p));
		watcher.on("change", async (p) => {
			await unloader(p);
			await loader(p);
		});
		watcher.on("unlink", (p) => unloader(p));
	}

	private async unloadProvider(filePath: string) {
		const uniqueKey = this.providers.get(filePath);
		if (uniqueKey) {
			const provider = this.providersRegistry.get(uniqueKey) as IProvider<any>;
			if (provider) {
				this.logger.logDebug(`Removiendo provider: ${provider.name}`);
				await provider.shutdown?.();
				this.providersRegistry.delete(uniqueKey);
				if (provider.type && provider.type !== provider.name) {
					const typeKey = this.getUniqueKey(provider.type, (Kernel.moduleLoader.getConfigByPath(path.dirname(filePath)) || {}).config);
					this.providersRegistry.delete(typeKey);
				}
				const keys = this.providerNameMap.get(provider.name);
				if (keys) {
					const index = keys.indexOf(uniqueKey);
					if (index > -1) {
						keys.splice(index, 1);
					}
				}
			}
			this.providers.delete(filePath);
		}
	}

	private async unloadMiddleware(filePath: string) {
		const uniqueKey = this.middlewares.get(filePath);
		if (uniqueKey) {
			const mw = this.middlewaresRegistry.get(uniqueKey) as IMiddleware<any>;
			if (mw) {
				this.logger.logDebug(`Removiendo middleware: ${mw.name}`);
				await mw.shutdown?.();
				this.middlewaresRegistry.delete(uniqueKey);
				const keys = this.middlewareNameMap.get(mw.name);
				if (keys) {
					const index = keys.indexOf(uniqueKey);
					if (index > -1) {
						keys.splice(index, 1);
					}
				}
			}
			this.middlewares.delete(filePath);
		}
	}

	private async unloadPreset(filePath: string) {
		const uniqueKey = this.presets.get(filePath);
		if (uniqueKey) {
			const preset = this.presetsRegistry.get(uniqueKey) as IPreset<any>;
			if (preset) {
				this.logger.logDebug(`Removiendo preset: ${preset.name}`);
				await preset.shutdown?.();
				this.presetsRegistry.delete(uniqueKey);
				const keys = this.presetNameMap.get(preset.name);
				if (keys) {
					const index = keys.indexOf(uniqueKey);
					if (index > -1) {
						keys.splice(index, 1);
					}
				}
			}
			this.presets.delete(filePath);
		}
	}

	private async unloadApp(filePath: string) {
		// Find all apps associated with this file path
		const keysToUnload = Array.from(this.apps.keys()).filter((key) => key.startsWith(filePath));

		for (const key of keysToUnload) {
			const app = this.apps.get(key);
			if (app) {
				this.logger.logDebug(`Removiendo app: ${app.name}`);
				await app.stop?.();
				this.appsRegistry.delete(app.name);
				this.apps.delete(key);
			}
		}
	}
}
