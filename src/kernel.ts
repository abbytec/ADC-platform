import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chokidar from "chokidar";
import { IApp } from "./interfaces/modules/IApp.js";
import { IMiddleware } from "./interfaces/modules/IMiddleware.js";
import { IProvider } from "./interfaces/modules/IProvider.js";
import { IPreset } from "./interfaces/modules/IPreset.js";
import { Logger } from "./utils/Logger/Logger.js";
import { ModuleLoader } from "./loaders/ModuleLoader.js";
import { ILogger } from "./interfaces/utils/ILogger.js";
import { IModule, IModuleConfig } from "./interfaces/modules/IModule.js";
import { ILifecycle } from "./interfaces/behaviours/ILifecycle.js";

type ModuleType = "provider" | "middleware" | "preset";

export class Kernel {
	private isStartingUp = true;
	private readonly logger: ILogger = Logger.getLogger("Kernel");

	// --- Registros por categoría ---
	private readonly providersRegistry = new Map<string, IModule>();
	private readonly middlewaresRegistry = new Map<string, IModule>();
	private readonly presetsRegistry = new Map<string, IModule>();
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
	public registerProvider(name: string, instance: IProvider<any>, type: string | undefined, config: IModuleConfig): void {
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

	private _getModule<T>(moduleType: ModuleType, name: string, config?: Record<string, any>): T {
		const registry = this[`${moduleType}sRegistry`];
		const nameMap = this[`${moduleType}NameMap`];
		const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);

		if (config) {
			const uniqueKey = this.getUniqueKey(name, config);
			const instance = registry.get(uniqueKey);
			if (!instance) {
				this.logger.logError(`${capitalizedModuleType} ${name} con la configuración especificada no encontrado.`);
				throw new Error(`${capitalizedModuleType} ${name} con la configuración especificada no encontrado.`);
			}
			return instance as T;
		}

		const keys = nameMap.get(name);
		if (!keys || keys.length === 0) {
			this.logger.logError(`${capitalizedModuleType} ${name} no encontrado.`);
			throw new Error(`${capitalizedModuleType} ${name} no encontrado.`);
		}

		if (keys.length > 1) {
			this.logger.logError(
				`Múltiples instancias de ${capitalizedModuleType} ${name} encontradas. Por favor, especifique una configuración para desambiguar.`
			);
			throw new Error(
				`Múltiples instancias de ${capitalizedModuleType} ${name} encontradas. Por favor, especifique una configuración para desambiguar.`
			);
		}

		return registry.get(keys[0]) as T;
	}

	public getProvider<T>(name: string, config?: Record<string, any>): T {
		return this._getModule("provider", name, config);
	}

	public getMiddleware<T>(name: string, config?: Record<string, any>): T {
		return this._getModule("middleware", name, config);
	}

	public getPreset<T>(name: string, config?: Record<string, any>): T {
		return this._getModule("preset", name, config);
	}

	public getApp(name: string): IApp {
		const instance = this.appsRegistry.get(name);
		if (!instance) {
			this.logger.logError(`App '${name}' no encontrada.`);
			throw new Error(`App '${name}' no encontrada.`);
		}
		return instance;
	}

	private _registerModule<T>(moduleType: "middleware" | "preset", name: string, instance: IModule, config: IModuleConfig): void {
		const registry = this[`${moduleType}sRegistry`];
		const nameMap = this[`${moduleType}NameMap`];
		const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
		const uniqueKey = this.getUniqueKey(name, config.config);

		if (registry.has(uniqueKey)) {
			this.logger.logDebug(`${capitalizedModuleType} ${name} con la misma configuración ya ha sido registrado.`);
			return;
		}

		registry.set(uniqueKey, instance);

		if (!nameMap.has(name)) {
			nameMap.set(name, []);
		}
		const keys = nameMap.get(name)!;
		keys.push(uniqueKey);

		this.logger.logOk(`${capitalizedModuleType} registrado: ${name} (Total de instancias: ${keys.length})`);
	}

	public registerMiddleware<T>(name: string, instance: IModule, config: IModuleConfig): void {
		this._registerModule("middleware", name, instance, config);
	}

	public registerPreset<T>(name: string, instance: IModule, config: IModuleConfig): void {
		this._registerModule("preset", name, instance, config);
	}

	public registerApp(name: string, instance: IApp): void {
		if (this.appsRegistry.has(name)) {
			this.logger.logDebug(`App '${name}' sobrescrita.`);
		}
		this.appsRegistry.set(name, instance);
		this.logger.logOk(`App registrada: ${name}`);
	}

	// --- Lógica de Arranque ---
	public async start(): Promise<void> {
		this.logger.logInfo("Iniciando...");
		this.logger.logInfo(`Modo: ${this.isDevelopment ? "DESARROLLO" : "PRODUCCIÓN"}`);
		this.logger.logDebug(`Base path: ${this.basePath}`);

		// Solo cargar Apps (que cargarán sus propios módulos desde modules.json)
		await this.loadLayerRecursive(this.appsPath, this.loadApp.bind(this), ["BaseApp.ts"]);

		// Iniciar watchers para carga dinámica
		this.watchLayer(this.providersPath, this._loadAndRegisterModule.bind(this, "provider"), this._unloadModule.bind(this, "provider"));
		this.watchLayer(this.middlewaresPath, this._loadAndRegisterModule.bind(this, "middleware"), this._unloadModule.bind(this, "middleware"));
		this.watchLayer(this.presetsPath, this._loadAndRegisterModule.bind(this, "preset"), this._unloadModule.bind(this, "preset"));
		this.watchLayer(this.appsPath, this.loadApp.bind(this), this.unloadApp.bind(this), ["BaseApp.ts"]);

		setTimeout(() => {
			this.isStartingUp = false;
			this.logger.logInfo("HMR está activo.");
		}, 5000);
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
				await preset.start?.();
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

		const elements: Record<string, Map<string, IModule>> = {
			App: this.apps,
			Preset: this.presetsRegistry,
			Middleware: this.middlewaresRegistry,
			Provider: this.providersRegistry,
		};

		for (const [name, instances] of Object.entries(elements)) {
			this.logger.logInfo(`Deteniendo ${name}s...`);

			for (const [key, instance] of instances) {
				try {
					this.logger.logDebug(`Deteniendo ${name} ${key}`);
					await instance.stop?.();
				} catch (e) {
					this.logger.logError(`Error deteniendo ${name} ${key}: ${e}`);
				}
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

	private async _loadAndRegisterModule(moduleType: ModuleType, filePath: string): Promise<void> {
		try {
			const modulePath = path.dirname(filePath);
			let config = Kernel.moduleLoader.getConfigByPath(modulePath);
			if (!config) {
				const moduleName = path.basename(modulePath);
				config = { name: moduleName };
			}

			let module: IProvider<any> | IMiddleware<any> | IPreset<any>;
			let instance: any;

			switch (moduleType) {
				case "provider": {
					const providerModule = await Kernel.moduleLoader.loadProvider(config);
					instance = await providerModule.getInstance();
					this.registerProvider(providerModule.name, instance, providerModule.type, config);
					module = providerModule;
					break;
				}
				case "middleware": {
					const middlewareModule = await Kernel.moduleLoader.loadMiddleware(config);
					instance = await middlewareModule.getInstance();
					this.registerMiddleware(middlewareModule.name, instance, config);
					module = middlewareModule;
					break;
				}
				case "preset": {
					const presetModule = await Kernel.moduleLoader.loadPreset(config, this);
					await presetModule.start?.();
					instance = presetModule.getInstance();
					this.registerPreset(presetModule.name, instance, config);
					module = presetModule;
					break;
				}
			}

			const uniqueKey = this.getUniqueKey(module.name, config.config);
			const fileMap = this[`${moduleType}s`];
			fileMap.set(filePath, uniqueKey);
		} catch (e) {
			const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
			this.logger.logError(`Error cargando ${capitalizedModuleType} ${filePath}: ${e}`);
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
			awaitWriteFinish: {
				stabilityThreshold: 2000,
				pollInterval: 100,
			},
		});
		watcher.on("add", (p) => {
			if (this.isStartingUp) return;
			loader(p);
		});
		watcher.on("change", async (p) => {
			if (this.isStartingUp) return;
			await unloader(p);
			await loader(p);
		});
		watcher.on("unlink", (p) => {
			if (this.isStartingUp) return;
			unloader(p);
		});
	}

	private async _unloadModule(moduleType: ModuleType, filePath: string) {
		const fileMap = this[`${moduleType}s`];
		const uniqueKey = fileMap.get(filePath);
		if (uniqueKey) {
			const registry = this[`${moduleType}sRegistry`];
			const module = registry.get(uniqueKey) as IProvider<any> | IMiddleware<any> | IPreset<any>;
			if (module) {
				const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
				this.logger.logDebug(`Removiendo ${capitalizedModuleType}: ${module.name}`);
				await module.stop?.();
				registry.delete(uniqueKey);

				if (moduleType === "provider") {
					const provider = module as IProvider<any>;
					if (provider.type && provider.type !== provider.name) {
						const typeKey = this.getUniqueKey(provider.type, Kernel.moduleLoader.getConfigByPath(path.dirname(filePath))?.config);
						this.providersRegistry.delete(typeKey);
					}
				}

				const nameMap = this[`${moduleType}NameMap`];
				const keys = nameMap.get(module.name);
				if (keys) {
					const index = keys.indexOf(uniqueKey);
					if (index > -1) {
						keys.splice(index, 1);
					}
				}
			}
			fileMap.delete(filePath);
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
