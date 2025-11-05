import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chokidar from "chokidar";
import { IApp } from "./interfaces/modules/IApp.js";
import { IUtility } from "./interfaces/modules/IUtility.js";
import { IProvider } from "./interfaces/modules/IProvider.js";
import { IService } from "./interfaces/modules/IService.js";
import { Logger } from "./utils/logger/Logger.js";
import { ModuleLoader } from "./utils/loaders/ModuleLoader.js";
import { ILogger } from "./interfaces/utils/ILogger.js";
import { IModule, IModuleConfig } from "./interfaces/modules/IModule.js";

type ModuleType = "provider" | "utility" | "service";

export class Kernel {
	#isStartingUp = true;
	readonly #logger: ILogger = Logger.getLogger("Kernel");

	// --- Contexto de carga para reference counting ---
	#currentLoadingContext: string | null = null;

	// --- Registros por categoría ---
	readonly #appsRegistry = new Map<string, IApp>();

	readonly #moduleStore = {
		provider: {
			registry: new Map<string, IModule>(),
			nameMap: new Map<string, string[]>(),
			fileToUniqueKeyMap: new Map<string, string>(),
			refCount: new Map<string, number>(),
		},
		utility: {
			registry: new Map<string, IModule>(),
			nameMap: new Map<string, string[]>(),
			fileToUniqueKeyMap: new Map<string, string>(),
			refCount: new Map<string, number>(),
		},
		service: {
			registry: new Map<string, IModule>(),
			nameMap: new Map<string, string[]>(),
			fileToUniqueKeyMap: new Map<string, string>(),
			refCount: new Map<string, number>(),
		},
	};

	// Mapa de dependencias: appName -> Set<{type, uniqueKey}>
	readonly #appModuleDependencies = new Map<string, Set<{ type: ModuleType; uniqueKey: string }>>();

	#getRegistry(moduleType: ModuleType): Map<string, IModule> {
		return this.#moduleStore[moduleType].registry;
	}

	#getNameMap(moduleType: ModuleType): Map<string, string[]> {
		return this.#moduleStore[moduleType].nameMap;
	}

	#getRefCountMap(moduleType: ModuleType): Map<string, number> {
		return this.#moduleStore[moduleType].refCount;
	}

	readonly #appFilePaths = new Map<string, string>(); // filePath -> appName
	readonly #appConfigFilePaths = new Map<string, string>(); // configFilePath -> instanceName

	#getFileToUniqueKeyMap(moduleType: ModuleType): Map<string, string> {
		return this.#moduleStore[moduleType].fileToUniqueKeyMap;
	}

	// --- Gestor de carga ---
	public static readonly moduleLoader = new ModuleLoader();

	// --- Determinación de entorno ---
	readonly #isDevelopment = process.env.NODE_ENV === "development";
	readonly #basePath = this.#isDevelopment ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");
	readonly #fileExtension = this.#isDevelopment ? ".ts" : ".js";

	// --- Rutas ---
	readonly #providersPath = path.resolve(this.#basePath, "providers");
	readonly #utilitiesPath = path.resolve(this.#basePath, "utilities");
	readonly #servicesPath = path.resolve(this.#basePath, "services");
	readonly #appsPath = path.resolve(this.#basePath, "apps");

	#getUniqueKey(name: string, config?: Record<string, any>): string {
		return `${name}:${JSON.stringify(config || {})}`;
	}

	#addModuleToRegistry(moduleType: ModuleType, name: string, uniqueKey: string, instance: IModule, appName?: string): void {
		const registry = this.#getRegistry(moduleType);
		const nameMap = this.#getNameMap(moduleType);
		const refCountMap = this.#getRefCountMap(moduleType);
		const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);

		// Usar el contexto de carga si no se proporciona appName explícito
		const effectiveAppName = appName || this.#currentLoadingContext;

		const alreadyExists = registry.has(uniqueKey);

		if (alreadyExists) {
			// Incrementar el contador de referencias
			const currentCount = refCountMap.get(uniqueKey) || 0;
			refCountMap.set(uniqueKey, currentCount + 1);
			this.#logger.logDebug(`${capitalizedModuleType} ${name} reutilizado (Referencias: ${currentCount + 1})`);
		} else {
			// Registrar nuevo módulo
			registry.set(uniqueKey, instance);
			refCountMap.set(uniqueKey, 1);

			if (!nameMap.has(name)) {
				nameMap.set(name, []);
			}
			const keys = nameMap.get(name)!;
			keys.push(uniqueKey);

			this.#logger.logOk(`${capitalizedModuleType} registrado: ${name} (Total de instancias: ${keys.length})`);
		}

		// Registrar la dependencia en la app
		if (effectiveAppName) {
			if (!this.#appModuleDependencies.has(effectiveAppName)) {
				this.#appModuleDependencies.set(effectiveAppName, new Set());
			}
			this.#appModuleDependencies.get(effectiveAppName)!.add({ type: moduleType, uniqueKey });
		}
	}

	/**
	 * Limpia las referencias de módulos de una app y remueve módulos sin referencias
	 */
	async #cleanupAppModules(appName: string): Promise<void> {
		const dependencies = this.#appModuleDependencies.get(appName);
		if (!dependencies) return;

		for (const { type, uniqueKey } of dependencies) {
			const refCountMap = this.#getRefCountMap(type);
			const currentCount = refCountMap.get(uniqueKey) || 0;

			if (currentCount > 1) {
				// Decrementar el contador de referencias
				refCountMap.set(uniqueKey, currentCount - 1);
				this.#logger.logDebug(`Referencias decrementadas para ${type} ${uniqueKey}: ${currentCount - 1}`);
			} else {
				// Eliminar el módulo completamente
				const registry = this.#getRegistry(type);
				const module = registry.get(uniqueKey);

				if (module) {
					this.#logger.logDebug(`Limpiando ${type}: ${uniqueKey}`);
					await module.stop?.();
					registry.delete(uniqueKey);
					refCountMap.delete(uniqueKey);

					// Limpiar del nameMap
					const nameMap = this.#getNameMap(type);
					for (const [name, keys] of nameMap.entries()) {
						const index = keys.indexOf(uniqueKey);
						if (index > -1) {
							keys.splice(index, 1);
							if (keys.length === 0) {
								nameMap.delete(name);
							}
						}
					}
				}
			}
		}

		// Limpiar las dependencias de la app
		this.#appModuleDependencies.delete(appName);
	}

	// --- API Pública del Kernel ---
	public registerProvider(name: string, instance: IProvider<any>, type: string | undefined, config: IModuleConfig, appName?: string): void {
		const nameUniqueKey = this.#getUniqueKey(name, config.config);
		this.#addModuleToRegistry("provider", name, nameUniqueKey, instance, appName);

		if (type && type !== name) {
			const typeUniqueKey = this.#getUniqueKey(type, config.config);
			this.#addModuleToRegistry("provider", type, typeUniqueKey, instance, appName);
		}
	}

	#registerModule<T>(moduleType: "utility" | "service", name: string, instance: IModule, config: IModuleConfig, appName?: string): void {
		const uniqueKey = this.#getUniqueKey(name, config.config);
		this.#addModuleToRegistry(moduleType, name, uniqueKey, instance, appName);
	}
	#getModule<T>(moduleType: ModuleType, name: string, config?: Record<string, any>): T {
		const registry = this.#getRegistry(moduleType);
		const nameMap = this.#getNameMap(moduleType);
		const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);

		if (config) {
			const uniqueKey = this.#getUniqueKey(name, config);
			const instance = registry.get(uniqueKey);
			if (!instance) {
				const errorMessage = `${capitalizedModuleType} ${name} con la configuración especificada no encontrado.`;
				this.#logger.logError(errorMessage);
				throw new Error(errorMessage);
			}
			return instance as T;
		}

		const keys = nameMap.get(name);
		if (!keys || keys.length === 0) {
			const errorMessage = `${capitalizedModuleType} ${name} no encontrado.`;
			this.#logger.logError(errorMessage);
			throw new Error(errorMessage);
		}

		if (keys.length > 1) {
			const errorMessage = `Múltiples instancias de ${capitalizedModuleType} ${name} encontradas. Por favor, especifique una configuración para desambiguar.`;
			this.#logger.logError(errorMessage);
			throw new Error(errorMessage);
		}

		return registry.get(keys[0]) as T;
	}

	public getProvider<T>(name: string, config?: Record<string, any>): T {
		return this.#getModule("provider", name, config);
	}

	public getUtility<T>(name: string, config?: Record<string, any>): T {
		return this.#getModule("utility", name, config);
	}

	public getService<T>(name: string, config?: Record<string, any>): T {
		return this.#getModule("service", name, config);
	}

	public getApp(name: string): IApp {
		const instance = this.#appsRegistry.get(name);
		if (!instance) {
			this.#logger.logError(`App '${name}' no encontrada.`);
			throw new Error(`App '${name}' no encontrada.`);
		}
		return instance;
	}

	public registerUtility<T>(name: string, instance: IModule, config: IModuleConfig, appName?: string): void {
		this.#registerModule("utility", name, instance, config, appName);
	}

	public registerService<T>(name: string, instance: IModule, config: IModuleConfig, appName?: string): void {
		this.#registerModule("service", name, instance, config, appName);
	}

	public registerApp(name: string, instance: IApp): void {
		if (this.#appsRegistry.has(name)) {
			this.#logger.logDebug(`App '${name}' sobrescrita.`);
		}
		this.#appsRegistry.set(name, instance);
		this.#logger.logOk(`App registrada: ${name}`);
	}

	// --- Lógica de Arranque ---
	public async start(): Promise<void> {
		this.#logger.logInfo("Iniciando...");
		this.#logger.logInfo(`Modo: ${this.#isDevelopment ? "DESARROLLO" : "PRODUCCIÓN"}`);
		this.#logger.logDebug(`Base path: ${this.#basePath}`);

		// Solo cargar Apps (que cargarán sus propios módulos desde modules.json)
		await this.#loadLayerRecursive(this.#appsPath, this.#loadApp.bind(this), ["BaseApp.ts"]);

		// Iniciar watchers para carga dinámica
		this.#watchLayer(this.#providersPath, this.#loadAndRegisterModule.bind(this, "provider"), this.#unloadModule.bind(this, "provider"));
		this.#watchLayer(this.#utilitiesPath, this.#loadAndRegisterModule.bind(this, "utility"), this.#unloadModule.bind(this, "utility"));
		this.#watchLayer(this.#servicesPath, this.#loadAndRegisterModule.bind(this, "service"), this.#unloadModule.bind(this, "service"));
		this.#watchLayer(this.#appsPath, this.#loadApp.bind(this), this.#unloadApp.bind(this), ["BaseApp.ts"]);

		// Watcher para archivos de configuración de apps
		this.#watchAppConfigs();

		setTimeout(() => {
			this.#isStartingUp = false;
			this.#logger.logInfo("HMR está activo.");
		}, 5000);
	}

	/**
	 * Carga un módulo específico de un tipo (provider, utility o service)
	 */
	public async loadModuleOfType(
		type: "provider" | "utility" | "service",
		moduleName: string,
		versionRange: string = "latest",
		language: string = "typescript"
	): Promise<void> {
		try {
			const config = { name: moduleName, version: versionRange, language };
			await this.#loadAndRegisterSpecificModule(type, config);
		} catch (error) {
			this.#logger.logError(`Error cargando ${type} '${moduleName}': ${error}`);
		}
	}

	// --- Lógica de Cierre ---
	public async stop(): Promise<void> {
		this.#logger.logInfo("\nIniciando cierre ordenado...");

		// Detener Apps
		this.#logger.logInfo(`Deteniendo Apps...`);
		for (const [name, instance] of this.#appsRegistry) {
			try {
				this.#logger.logDebug(`Deteniendo App ${name}`);
				await instance.stop?.();
			} catch (e) {
				this.#logger.logError(`Error deteniendo App ${name}: ${e}`);
			}
		}

		// Detener otros módulos
		for (const moduleType of ["provider", "utility", "service"] as ModuleType[]) {
			let capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
			this.#logger.logInfo(`Deteniendo ${capitalizedModuleType == "Utility" ? "Utilitie" : capitalizedModuleType}s...`);
			const registry = this.#getRegistry(moduleType);
			for (const [key, instance] of registry) {
				try {
					this.#logger.logDebug(`Deteniendo ${capitalizedModuleType} ${key}`);
					await instance.stop?.();
				} catch (e) {
					this.#logger.logError(`Error deteniendo ${capitalizedModuleType} ${key}: ${e}`);
				}
			}
		}
		this.#logger.logOk("Cierre completado.");
	}

	/**
	 * Búsqueda recursiva ilimitada de todos los 'index.ts'/'index.js' en una capa.
	 */
	async #loadLayerRecursive(dir: string, loader: (entryPath: string) => Promise<void>, exclude: string[] = []): Promise<void> {
		try {
			// Primero, buscar si el mismo directorio tiene index
			const indexPath = path.join(dir, `index${this.#fileExtension}`);
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
					await this.#loadLayerRecursive(subDirPath, loader, exclude);
				}
			}
		} catch {
			// El directorio no existe o no se puede leer, ignorar
		}
	}

	async #loadAndRegisterSpecificModule(
		moduleType: ModuleType,
		config: IModuleConfig
	): Promise<IProvider<any> | IUtility<any> | IService<any>> {
		let module: IProvider<any> | IUtility<any> | IService<any>;

		switch (moduleType) {
			case "provider": {
				const providerModule = await Kernel.moduleLoader.loadProvider(config);
				this.registerProvider(providerModule.name, providerModule, providerModule.type, config);
				module = providerModule;
				break;
			}
			case "utility": {
				const utilityModule = await Kernel.moduleLoader.loadUtility(config);
				this.registerUtility(utilityModule.name, utilityModule, config);
				module = utilityModule;
				break;
			}
			case "service": {
				const serviceModule = await Kernel.moduleLoader.loadService(config, this);
				await serviceModule.start?.();
				this.registerService(serviceModule.name, serviceModule, config);
				module = serviceModule;
				break;
			}
		}
		return module!;
	}

	async #loadAndRegisterModule(moduleType: ModuleType, filePath: string): Promise<void> {
		try {
			const modulePath = path.dirname(filePath);
			let config = Kernel.moduleLoader.getConfigByPath(modulePath);
			if (!config) {
				const moduleName = path.basename(modulePath);
				config = { name: moduleName };
			}

			const module = await this.#loadAndRegisterSpecificModule(moduleType, config);

			const uniqueKey = this.#getUniqueKey(module.name, config.config);
			const fileMap = this.#getFileToUniqueKeyMap(moduleType);
			fileMap.set(filePath, uniqueKey);
		} catch (e) {
			const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
			this.#logger.logError(`Error cargando ${capitalizedModuleType} ${filePath}: ${e}`);
		}
	}

	#getConfigName(configFile: string): string {
		const configNameRaw = path.basename(configFile, ".json");
		return configNameRaw === "config"
			? "default"
			: configNameRaw.startsWith("config-")
			? configNameRaw.substring("config-".length)
			: configNameRaw;
	}

	async #initializeAndRunApp(app: IApp, filePath: string, instanceName: string, configPath?: string): Promise<void> {
		this.registerApp(instanceName, app);
		this.#logger.logDebug(`Inicializando App ${app.name}`);

		// Establecer contexto de carga para reference counting
		this.#currentLoadingContext = instanceName;
		try {
			await app.loadModulesFromConfig();
			await app.start?.();
		} finally {
			// Limpiar contexto de carga
			this.#currentLoadingContext = null;
		}

		this.#appFilePaths.set(`${filePath}:${instanceName}`, instanceName);
		if (configPath) {
			this.#appConfigFilePaths.set(configPath, instanceName);
		}
		this.#logger.logDebug(`Ejecutando App ${app.name}`);
		await app.run();
	}

	async #reloadAppInstance(configPath: string): Promise<void> {
		try {
			const instanceName = this.#appConfigFilePaths.get(configPath);
			if (!instanceName) {
				this.#logger.logWarn(`No se encontró instancia para el archivo de configuración: ${configPath}`);
				return;
			}

			// Detener y remover la instancia actual
			const app = this.#appsRegistry.get(instanceName);
			if (app) {
				this.#logger.logInfo(`Recargando instancia de App: ${instanceName}`);
				await app.stop?.();

				// Limpiar módulos asociados a esta app
				await this.#cleanupAppModules(instanceName);

				this.#appsRegistry.delete(instanceName);

				// Limpiar referencias en #appFilePaths
				for (const [key, value] of this.#appFilePaths.entries()) {
					if (value === instanceName) {
						this.#appFilePaths.delete(key);
					}
				}
			}

			// Obtener información de la app
			const appName = instanceName.split(":")[0];
			const appDir = this.#isDevelopment
				? path.resolve(process.cwd(), "src", "apps", appName)
				: path.resolve(process.cwd(), "dist", "apps", appName);
			const appFilePath = path.join(appDir, `index${this.#fileExtension}`);

			// Cargar la clase de la app
			const module = await import(`${appFilePath}?v=${Date.now()}`);
			const AppClass = module.default;
			if (!AppClass) {
				this.#logger.logError(`No se pudo cargar la clase de la app: ${appName}`);
				return;
			}

			// Leer la configuración actualizada
			const config = JSON.parse(await fs.readFile(configPath, "utf-8"));

			// Crear y ejecutar la nueva instancia
			const newApp: IApp = new AppClass(this, instanceName, config);
			await this.#initializeAndRunApp(newApp, appFilePath, instanceName, configPath);

			this.#logger.logOk(`Instancia recargada exitosamente: ${instanceName}`);
		} catch (error) {
			this.#logger.logError(`Error recargando instancia desde ${configPath}: ${error}`);
		}
	}

	async #loadApp(filePath: string): Promise<void> {
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
					const files = await fs
						.readdir(dir)
						.then((files) => files.filter((file) => file.startsWith("config") && file.endsWith(".json")));
					for (const file of files) {
						allConfigFiles.push(path.join(dir, file));
					}
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
						this.#logger.logWarn(`No se pudo leer el directorio de configuración ${dir}: ${error}`);
					}
				}
			}

			if (allConfigFiles.length > 0) {
				for (const configPath of allConfigFiles) {
					const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
					const configFile = path.basename(configPath);
					const configName = this.#getConfigName(configFile);
					const instanceName = `${appName}:${configName}`;

					const app: IApp = new AppClass(this, instanceName, config);
					await this.#initializeAndRunApp(app, filePath, instanceName, configPath);
				}
			} else {
				const app: IApp = new AppClass(this, appName);
				await this.#initializeAndRunApp(app, filePath, appName);
			}
		} catch (e) {
			this.#logger.logError(`Error ejecutando App ${filePath}: ${e}`);
		}
	}

	// --- Lógica de Watchers y Descarga ---
	#watchAppConfigs() {
		// Siempre observar los archivos fuente en src/
		const srcAppsPath = path.resolve(process.cwd(), "src", "apps");
		const patterns = [path.join(srcAppsPath, "**/*.json"), path.join(srcAppsPath, "**/configs/*.json")];

		const watcher = chokidar.watch(patterns, {
			ignoreInitial: true,
			ignored: (filePath) => {
				// Ignorar archivos default.json
				return path.basename(filePath) === "default.json";
			},
			awaitWriteFinish: {
				stabilityThreshold: 2000,
				pollInterval: 100,
			},
		});

		watcher.on("change", async (srcConfigPath) => {
			if (this.#isStartingUp) return;
			this.#logger.logInfo(`Detectado cambio en configuración: ${path.basename(srcConfigPath)}`);

			// Si estamos en producción, copiar el archivo a dist/
			let targetConfigPath = srcConfigPath;
			if (!this.#isDevelopment) {
				const relativePath = path.relative(srcAppsPath, srcConfigPath);
				const distConfigPath = path.join(this.#appsPath, relativePath);
				await fs.mkdir(path.dirname(distConfigPath), { recursive: true });
				await fs.copyFile(srcConfigPath, distConfigPath);
				targetConfigPath = distConfigPath;
				this.#logger.logDebug(`Archivo copiado a: ${distConfigPath}`);
			}

			await this.#reloadAppInstance(targetConfigPath);
		});

		watcher.on("add", async (srcConfigPath) => {
			if (this.#isStartingUp) return;

			// Si estamos en producción, copiar el archivo a dist/
			let targetConfigPath = srcConfigPath;
			if (!this.#isDevelopment) {
				const relativePath = path.relative(srcAppsPath, srcConfigPath);
				const distConfigPath = path.join(this.#appsPath, relativePath);
				await fs.mkdir(path.dirname(distConfigPath), { recursive: true });
				await fs.copyFile(srcConfigPath, distConfigPath);
				targetConfigPath = distConfigPath;
			}

			// Cuando se agrega un nuevo archivo de configuración, necesitamos cargar la app completa
			// para crear la nueva instancia
			const appDirResolved = targetConfigPath.includes("/configs/")
				? path.dirname(path.dirname(targetConfigPath))
				: path.dirname(targetConfigPath);
			const appFilePath = path.join(appDirResolved, `index${this.#fileExtension}`);

			try {
				await fs.stat(appFilePath);
				this.#logger.logInfo(`Nuevo archivo de configuración detectado: ${path.basename(srcConfigPath)}`);
				await this.#loadApp(appFilePath);
			} catch {
				// El archivo de app no existe, ignorar
			}
		});

		watcher.on("unlink", async (srcConfigPath) => {
			if (this.#isStartingUp) return;

			// Determinar la ruta correcta según el entorno
			let targetConfigPath = srcConfigPath;
			if (!this.#isDevelopment) {
				const relativePath = path.relative(srcAppsPath, srcConfigPath);
				targetConfigPath = path.join(this.#appsPath, relativePath);
				// Eliminar el archivo en dist/ también
				try {
					await fs.unlink(targetConfigPath);
				} catch {
					// Ignorar si no existe
				}
			}

			const instanceName = this.#appConfigFilePaths.get(targetConfigPath);
			if (instanceName) {
				this.#logger.logInfo(`Archivo de configuración eliminado: ${path.basename(srcConfigPath)}`);
				const app = this.#appsRegistry.get(instanceName);
				if (app) {
					await app.stop?.();
					this.#appsRegistry.delete(instanceName);
				}
				this.#appConfigFilePaths.delete(targetConfigPath);
			}
		});
	}

	#watchLayer(dir: string, loader: (p: string) => Promise<void>, unloader: (p: string) => Promise<void>, exclude: string[] = []) {
		const watcher = chokidar.watch(path.join(dir, `**/index${this.#fileExtension}`), {
			ignoreInitial: true,
			ignored: exclude,
			awaitWriteFinish: {
				stabilityThreshold: 2000,
				pollInterval: 100,
			},
		});
		watcher.on("add", (p) => {
			if (this.#isStartingUp) return;
			loader(p);
		});
		watcher.on("change", async (p) => {
			if (this.#isStartingUp) return;
			await unloader(p);
			await loader(p);
		});
		watcher.on("unlink", (p) => {
			if (this.#isStartingUp) return;
			unloader(p);
		});
	}

	async #unloadModule(moduleType: ModuleType, filePath: string) {
		const fileMap = this.#getFileToUniqueKeyMap(moduleType);
		const uniqueKey = fileMap.get(filePath);
		if (uniqueKey) {
			const registry = this.#getRegistry(moduleType);
			const module = registry.get(uniqueKey) as IProvider<any> | IUtility<any> | IService<any>;
			if (module) {
				const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
				this.#logger.logDebug(`Removiendo ${capitalizedModuleType}: ${module.name}`);
				await module.stop?.();
				registry.delete(uniqueKey);

				if (moduleType === "provider") {
					const provider = module as IProvider<any>;
					if (provider.type && provider.type !== provider.name) {
						const typeKey = this.#getUniqueKey(provider.type, Kernel.moduleLoader.getConfigByPath(path.dirname(filePath))?.config);
						const providerRegistry = this.#getRegistry("provider");
						providerRegistry.delete(typeKey);
					}
				}

				const nameMap = this.#getNameMap(moduleType);
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

	async #unloadApp(filePath: string) {
		// Find all apps associated with this file path
		const keysToUnload = Array.from(this.#appFilePaths.keys()).filter((key) => key.startsWith(filePath));

		for (const key of keysToUnload) {
			const appName = this.#appFilePaths.get(key);
			if (appName) {
				const app = this.#appsRegistry.get(appName);
				if (app) {
					this.#logger.logDebug(`Removiendo app: ${app.name}`);
					await app.stop?.();

					// Limpiar módulos asociados a esta app
					await this.#cleanupAppModules(appName);

					this.#appsRegistry.delete(app.name);
					this.#appFilePaths.delete(key);

					// Limpiar referencias en appConfigFilePaths
					for (const [configPath, instanceName] of this.#appConfigFilePaths.entries()) {
						if (instanceName === appName) {
							this.#appConfigFilePaths.delete(configPath);
						}
					}
				}
			}
		}
	}
}
