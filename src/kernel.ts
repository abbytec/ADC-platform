import "dotenv/config";
import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
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
type Module = IProvider<any> | IUtility<any> | IService<any>;

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

	// Mapa de apps con docker-compose: appName -> directorio
	readonly #appDockerComposeMap = new Map<string, string>();

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
	readonly #basePath = path.resolve(process.cwd(), "src");
	readonly #fileExtension = ".ts";

	// --- Rutas ---
	readonly #providersPath = path.resolve(this.#basePath, "providers");
	readonly #utilitiesPath = path.resolve(this.#basePath, "utilities");
	readonly #servicesPath = path.resolve(this.#basePath, "services");
	readonly #appsPath = path.resolve(this.#basePath, "apps");

	#getUniqueKey(name: string, config?: Record<string, any>): string {
		return `${name}:${JSON.stringify(config || {})}`;
	}

	#addModuleToRegistry(
		moduleType: ModuleType,
		name: string,
		uniqueKey: string,
		instance: IModule,
		appName?: string | null,
		silent = false
	): void {
		const registry = this.#getRegistry(moduleType);
		const nameMap = this.#getNameMap(moduleType);
		const refCountMap = this.#getRefCountMap(moduleType);
		const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);

		// Usar el contexto de carga solo si appName es undefined (no si es null)
		// null = explícitamente NO registrar como dependencia de app
		const effectiveAppName = appName === undefined ? this.#currentLoadingContext : appName;

		const alreadyExists = registry.has(uniqueKey);

		if (alreadyExists) {
			// Incrementar el contador de referencias
			const currentCount = refCountMap.get(uniqueKey) || 0;
			refCountMap.set(uniqueKey, currentCount + 1);
			if (!silent) {
				this.#logger.logDebug(`${capitalizedModuleType} ${name} reutilizado (Referencias: ${currentCount + 1})`);
			}
		} else {
			// Registrar nuevo módulo
			registry.set(uniqueKey, instance);
			refCountMap.set(uniqueKey, 1);

			if (!nameMap.has(name)) {
				nameMap.set(name, []);
			}
			const keys = nameMap.get(name)!;
			keys.push(uniqueKey);

			// Contar instancias únicas para el log
			if (!silent) {
				const uniqueInstances = new Set(keys.map((k) => registry.get(k))).size;
				this.#logger.logOk(`${capitalizedModuleType} registrado: ${name} (Instancias únicas: ${uniqueInstances})`);
			}
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
	public registerProvider(
		name: string,
		instance: IProvider<any>,
		type: string | undefined,
		config: IModuleConfig,
		appName?: string | null
	): void {
		const nameUniqueKey = this.#getUniqueKey(name, config.config);
		this.#addModuleToRegistry("provider", name, nameUniqueKey, instance, appName);

		// Registrar también por tipo (alias) pero sin log
		if (type && type !== name) {
			const typeUniqueKey = this.#getUniqueKey(type, config.config);
			this.#addModuleToRegistry("provider", type, typeUniqueKey, instance, appName, true); // silent = true
		}
	}

	#registerModule(moduleType: "utility" | "service", name: string, instance: IModule, config: IModuleConfig, appName?: string | null): void {
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

		let keys = nameMap.get(name);
		if (!keys || keys.length === 0) {
			const errorMessage = `${capitalizedModuleType} ${name} no encontrado.`;
			this.#logger.logError(errorMessage);
			throw new Error(errorMessage);
		}

		if (keys.length > 1) {
			let filteredKeys = keys;

			// 1. Try to filter by current app context
			if (this.#currentLoadingContext) {
				const appDependencies = this.#appModuleDependencies.get(this.#currentLoadingContext);
				if (appDependencies) {
					const appDependencyKeys = new Set(
						Array.from(appDependencies)
							.filter((dep) => dep.type === moduleType)
							.map((dep) => dep.uniqueKey)
					);
					const matchingKeys = keys.filter((key) => appDependencyKeys.has(key));

					if (matchingKeys.length > 0) {
						filteredKeys = matchingKeys;
					}
				}
			}

			// 2. If still ambiguous, apply specificity rule WITHIN the filtered set
			if (filteredKeys.length > 1) {
				const sorted = [...filteredKeys].sort((a, b) => b.length - a.length);
				// Only pick if there is a single most-specific key
				if (sorted[0].length > sorted[1].length) {
					filteredKeys = [sorted[0]];
				}
			}

			keys = filteredKeys;
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

	public registerUtility(name: string, instance: IModule, config: IModuleConfig, appName?: string | null): void {
		this.#registerModule("utility", name, instance, config, appName);
	}

	public registerService(name: string, instance: IModule, config: IModuleConfig, appName?: string | null): void {
		this.#registerModule("service", name, instance, config, appName);
	}

	public registerApp(name: string, instance: IApp): void {
		if (this.#appsRegistry.has(name)) {
			this.#logger.logDebug(`App '${name}' sobrescrita.`);
		}
		this.#appsRegistry.set(name, instance);
		this.#logger.logOk(`App registrada: ${name}`);
	}

	/**
	 * Registra una dependencia de módulo existente para una app
	 * (para reference counting sin volver a cargar el módulo)
	 */
	public addModuleDependency(moduleType: ModuleType, name: string, config?: Record<string, any>, appName?: string): void {
		const uniqueKey = this.#getUniqueKey(name, config);
		const registry = this.#getRegistry(moduleType);
		const refCountMap = this.#getRefCountMap(moduleType);

		if (!registry.has(uniqueKey)) {
			this.#logger.logWarn(`Intentando agregar dependencia de ${moduleType} ${name} que no existe en el registry`);
			return;
		}

		const effectiveAppName = appName || this.#currentLoadingContext;

		if (effectiveAppName) {
			if (!this.#appModuleDependencies.has(effectiveAppName)) {
				this.#appModuleDependencies.set(effectiveAppName, new Set());
			}

			const instance = registry.get(uniqueKey);
			const deps = this.#appModuleDependencies.get(effectiveAppName)!;

			// Agregar a las dependencias de la app (solo si no existe ya)
			const depExists = Array.from(deps).some((d) => d.type === moduleType && d.uniqueKey === uniqueKey);
			if (!depExists) {
				deps.add({ type: moduleType, uniqueKey });

				// Incrementar reference count
				const currentCount = refCountMap.get(uniqueKey) || 0;
				refCountMap.set(uniqueKey, currentCount + 1);

				this.#logger.logDebug(`Dependencia agregada: ${moduleType} ${name} para ${effectiveAppName} (Referencias: ${currentCount + 1})`);
			}

			// Para providers, también agregar el alias (type) si existe
			if (moduleType === "provider" && instance) {
				const provider = instance as IProvider<any>;
				if (provider.type && provider.type !== name) {
					const typeKey = this.#getUniqueKey(provider.type, config);
					if (registry.has(typeKey)) {
						const typeDepExists = Array.from(deps).some((d) => d.type === moduleType && d.uniqueKey === typeKey);
						if (!typeDepExists) {
							deps.add({ type: moduleType, uniqueKey: typeKey });
							const typeCount = refCountMap.get(typeKey) || 0;
							refCountMap.set(typeKey, typeCount + 1);
							this.#logger.logDebug(
								`Dependencia agregada (alias): ${moduleType} ${provider.type} para ${effectiveAppName} (Referencias: ${
									typeCount + 1
								})`
							);
						}
					}
				}
			}
		}
	}

	/**
	 * Carga servicios en modo kernel antes de las apps
	 */
	async #loadKernelServices(): Promise<void> {
		const findKernelServices = async (dir: string): Promise<Array<{ path: string; name: string }>> => {
			const kernelServices: Array<{ path: string; name: string }> = [];

			const traverse = async (currentDir: string) => {
				const entries = await fs.readdir(currentDir, { withFileTypes: true });

				for (const entry of entries) {
					const fullPath = path.join(currentDir, entry.name);

					if (entry.isDirectory()) {
						// Buscar config.json en este directorio
						const configPath = path.join(fullPath, "config.json");
						try {
							await fs.access(configPath);
							const configContent = await fs.readFile(configPath, "utf-8");
							const config = JSON.parse(configContent);

							if (config.kernelMode === true) {
								// Buscar el archivo index.ts o index.js
								const indexTs = path.join(fullPath, "index.ts");
								const indexJs = path.join(fullPath, "index.js");

								try {
									await fs.access(indexTs);
									kernelServices.push({ path: indexTs, name: entry.name });
									continue;
								} catch {
									try {
										await fs.access(indexJs);
										kernelServices.push({ path: indexJs, name: entry.name });
										continue;
									} catch {
										// No tiene index, continuar buscando en subdirectorios
									}
								}
							}
						} catch {
							// No tiene config.json o no es válido, seguir buscando
						}

						// Continuar buscando recursivamente
						await traverse(fullPath);
					}
				}
			};

			await traverse(dir);
			return kernelServices;
		};

		const kernelServices = await findKernelServices(this.#servicesPath);

		if (kernelServices.length > 0) {
			this.#logger.logInfo(`Cargando ${kernelServices.length} servicio(s) en modo kernel...`);

			for (const { path: servicePath, name: serviceName } of kernelServices) {
				try {
					// Cargar el módulo directamente (sin versionado)
					const serviceModule = await import(servicePath);
					const ServiceClass = serviceModule.default;

					if (!ServiceClass) {
						throw new Error(`No se encontró export default en ${servicePath}`);
					}

					// Crear instancia del servicio
					const serviceInstance = new ServiceClass(this, {});
					await serviceInstance.start();

					// Registrar el servicio
					this.registerService(serviceName, serviceInstance, {
						name: serviceName,
						version: "1.0.0",
						language: "typescript",
						global: true,
					});

					this.#logger.logOk(`Servicio en modo kernel cargado: ${serviceName}`);
				} catch (error: any) {
					this.#logger.logError(`Error cargando servicio en modo kernel (${serviceName}): ${error.message}`);
				}
			}
		}
	}

	// --- Lógica de Arranque ---
	public async start(): Promise<void> {
		this.#logger.logInfo("Iniciando...");
		this.#logger.logInfo(`Modo: ${this.#isDevelopment ? "DESARROLLO" : "PRODUCCIÓN"}`);
		this.#logger.logDebug(`Base path: ${this.#basePath}`);

		// Cargar servicios en modo kernel primero
		await this.#loadKernelServices();

		// Solo cargar Apps (que cargarán sus propios módulos desde config.json)
		// En producción, excluir apps de test (cuando EXCLUDE_TESTS esté set)
		const excludeTests = process.env.EXCLUDE_TESTS === "true" && !this.#isDevelopment;
		const excludeList = excludeTests ? ["BaseApp.ts", "test"] : ["BaseApp.ts"];
		await this.#loadLayerRecursive(this.#appsPath, this.#loadApp.bind(this), excludeList);

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
		}, 10000);

		setInterval(() => {
			// Contar instancias únicas (no entradas en el registry)
			// Los providers se registran 2 veces (name y type), así que contamos instancias únicas
			const pCount = new Set(this.#moduleStore.provider.registry.values()).size;
			const uCount = new Set(this.#moduleStore.utility.registry.values()).size;
			const sCount = new Set(this.#moduleStore.service.registry.values()).size;
			this.#logger.logInfo(`Providers: ${pCount} - Utilities: ${uCount} - Services: ${sCount}`);

			const kernelState = {
				apps: Array.from(this.#appsRegistry.keys()),
				providers: {
					keys: Array.from(this.#moduleStore.provider.registry.keys()),
					refs: Object.fromEntries(this.#moduleStore.provider.refCount),
				},
				utilities: {
					keys: Array.from(this.#moduleStore.utility.registry.keys()),
					refs: Object.fromEntries(this.#moduleStore.utility.refCount),
				},
				services: {
					keys: Array.from(this.#moduleStore.service.registry.keys()),
					refs: Object.fromEntries(this.#moduleStore.service.refCount),
				},
				appDependencies: Object.fromEntries(
					Array.from(this.#appModuleDependencies.entries()).map(([appName, deps]) => [
						appName,
						Array.from(deps).map((dep) => ({
							type: dep.type,
							key: dep.uniqueKey,
						})),
					])
				),
				appFiles: Object.fromEntries(this.#appFilePaths),
				appConfigFiles: Object.fromEntries(this.#appConfigFilePaths),
			};
			this.#logger.logDebug("Kernel State Dump:", JSON.stringify(kernelState, null, 2));
		}, 30000);
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

		// Helper para ejecutar con timeout
		const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T | undefined> => {
			const timeoutPromise = new Promise<undefined>((resolve) => {
				setTimeout(() => {
					this.#logger.logWarn(`Timeout deteniendo ${name} (${timeoutMs}ms)`);
					resolve(undefined);
				}, timeoutMs);
			});
			return Promise.race([promise, timeoutPromise]);
		};

		// Detener Apps
		this.#logger.logInfo(`Deteniendo Apps...`);
		for (const [name, instance] of this.#appsRegistry) {
			try {
				this.#logger.logDebug(`Deteniendo App ${name}`);
				if (instance.stop) {
					await withTimeout(instance.stop(), 3000, `App ${name}`);
				}

				// Extraer el nombre base de la app (antes del primer ':')
				const appBaseName = name.split(":")[0];

				// Detener docker-compose si existe para esta app
				if (this.#appDockerComposeMap.has(appBaseName)) {
					const appDir = this.#appDockerComposeMap.get(appBaseName)!;
					try {
						await withTimeout(this.#stopDockerCompose(appDir), 5000, `Docker ${appBaseName}`);
						this.#appDockerComposeMap.delete(appBaseName);
					} catch (e) {
						this.#logger.logWarn(`Error deteniendo Docker para App ${appBaseName}: ${e}`);
					}
				}
			} catch (e) {
				this.#logger.logError(`Error deteniendo App ${name}: ${e}`);
			}
		}

		// Detener otros módulos
		for (const moduleType of ["provider", "utility", "service"] as ModuleType[]) {
			const capitalizedModuleType = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
			this.#logger.logInfo(`Deteniendo ${capitalizedModuleType == "Utility" ? "Utilitie" : capitalizedModuleType}s...`);
			const registry = this.#getRegistry(moduleType);
			for (const [key, instance] of registry) {
				try {
					this.#logger.logDebug(`Deteniendo ${capitalizedModuleType} ${key}`);
					if (instance.stop) {
						await withTimeout(instance.stop(), 2000, `${capitalizedModuleType} ${key}`);
					}
				} catch (e) {
					this.#logger.logError(`Error deteniendo ${capitalizedModuleType} ${key}: ${e}`);
				}
			}
		}
		this.#logger.logOk("Cierre completado.");
	}

	/**
	 * Búsqueda recursiva ilimitada de cada 'index.ts'/'index.js' en una capa.
	 * Carga apps en PARALELO cuando no tienen dependencias entre sí.
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

			// Construir niveles de carga basados en dependencias (para carga paralela)
			const loadLevels = await this.#buildAppLoadLevels(dir, entries, exclude);

			// Cargar cada nivel en paralelo (apps del mismo nivel no tienen dependencias entre sí)
			for (const level of loadLevels) {
				if (level.length === 1) {
					// Un solo elemento, cargar directamente
					await this.#loadLayerRecursive(level[0], loader, exclude);
				} else if (level.length > 1) {
					// Múltiples elementos sin dependencias entre sí: cargar en paralelo
					this.#logger.logDebug(`Cargando ${level.length} apps en paralelo...`);
					await Promise.all(
						level.map(subDirPath => this.#loadLayerRecursive(subDirPath, loader, exclude))
					);
				}
			}
		} catch {
			// El directorio no existe o no se puede leer, ignorar
		}
	}

	/**
	 * Construye NIVELES de carga de apps basados en uiDependencies.
	 * Apps del mismo nivel pueden cargarse en PARALELO (no tienen dependencias entre sí).
	 * Retorna: Array de niveles, cada nivel es un array de paths de apps.
	 *
	 * Nivel 0: UI libraries (Stencil) - siempre primero
	 * Nivel 1: Apps sin dependencias (o solo dependen de UI libs)
	 * Nivel 2+: Apps que dependen de apps del nivel anterior
	 * Último nivel: Hosts (isHost=true) - siempre al final para que detecten remotes
	 */
	async #buildAppLoadLevels(dir: string, entries: Dirent[], exclude: string[]): Promise<string[][]> {
		const appConfigs: Array<{
			path: string;
			dirName: string;
			name: string;
			dependencies: string[];
			isUILib: boolean;
			isHost: boolean;
			isRemote: boolean;
		}> = [];

		// 1. Recopilar información de todas las apps
		for (const entry of entries) {
			if (!entry.isDirectory() || exclude.includes(entry.name)) continue;

			const subDirPath = path.join(dir, entry.name);
			const configPath = path.join(subDirPath, "config.json");

			try {
				const configContent = await fs.readFile(configPath, "utf-8");
				const config = JSON.parse(configContent);

				if (config.uiModule) {
					const uiModule = config.uiModule;
					const appName = uiModule.name || entry.name;

					// Detectar UI libraries (Stencil con exports)
					const isUILib = uiModule.framework === "stencil" && uiModule.exports;

					// Detectar hosts y remotes
					const isHost = uiModule.isHost ?? false;
					const isRemote = uiModule.isRemote ?? false;

					// Obtener dependencias explícitas
					const dependencies = uiModule.uiDependencies || [];

					appConfigs.push({
						path: subDirPath,
						dirName: entry.name,
						name: appName,
						dependencies,
						isUILib,
						isHost,
						isRemote
					});
				} else {
					// Apps sin uiModule se cargan con prioridad normal
					appConfigs.push({
						path: subDirPath,
						dirName: entry.name,
						name: entry.name,
						dependencies: [],
						isUILib: false,
						isHost: false,
						isRemote: false
					});
				}
			} catch {
				// Si no hay config o error al leerlo, cargar sin dependencias
				appConfigs.push({
					path: subDirPath,
					dirName: entry.name,
					name: entry.name,
					dependencies: [],
					isUILib: false,
					isHost: false,
					isRemote: false
				});
			}
		}

		// 2. Construir niveles de carga
		const levels: string[][] = [];
		const loadedAppNames = new Set<string>();

		// Nivel 0: UI libraries (siempre primero, en paralelo entre ellas)
		const uiLibs = appConfigs.filter(app => app.isUILib);
		if (uiLibs.length > 0) {
			levels.push(uiLibs.map(app => app.path));
			uiLibs.forEach(app => loadedAppNames.add(app.name));
		}

		// Separar hosts de otros
		const hosts = appConfigs.filter(app => app.isHost && !app.isUILib);
		const others = appConfigs.filter(app => !app.isUILib && !app.isHost);

		// Procesar apps no-host por niveles de dependencia
		let pendingQueue = [...others];
		const maxIterations = 50;
		let iteration = 0;

		while (pendingQueue.length > 0 && iteration < maxIterations) {
			const currentLevel: string[] = [];
			const stillPending: typeof pendingQueue = [];

			for (const app of pendingQueue) {
				// Verificar si todas las dependencias ya están cargadas
				const allDepsLoaded = app.dependencies.every(depName => loadedAppNames.has(depName));

				if (allDepsLoaded) {
					currentLevel.push(app.path);
					loadedAppNames.add(app.name);
				} else {
					stillPending.push(app);
				}
			}

			if (currentLevel.length > 0) {
				levels.push(currentLevel);
			} else if (stillPending.length > 0) {
				// Deadlock: dependencias no satisfechas
				const pendingNames = stillPending.map(app => app.name).join(', ');
				const missingDeps = stillPending.map(app => {
					const missing = app.dependencies.filter(dep => !loadedAppNames.has(dep));
					return `${app.name} -> [${missing.join(', ')}]`;
				}).join('; ');

				this.#logger.logWarn(
					`Dependencias circulares o faltantes: ${pendingNames}. ` +
					`Faltantes: ${missingDeps}. Se cargarán en paralelo de todas formas.`
				);

				// Cargar todas las pendientes en un solo nivel
				levels.push(stillPending.map(app => app.path));
				stillPending.forEach(app => loadedAppNames.add(app.name));
				break;
			}

			pendingQueue = stillPending;
			iteration++;
		}

		// Último nivel: Hosts (para que detecten todos los remotes ya registrados)
		if (hosts.length > 0) {
			// Los hosts también pueden tener dependencias entre sí, ordenarlos
			let pendingHosts = [...hosts];
			let hostIterations = 0;

			while (pendingHosts.length > 0 && hostIterations < 10) {
				const currentHostLevel: string[] = [];
				const stillPendingHosts: typeof pendingHosts = [];

				for (const host of pendingHosts) {
					const allDepsLoaded = host.dependencies.every(depName => loadedAppNames.has(depName));
					if (allDepsLoaded) {
						currentHostLevel.push(host.path);
						loadedAppNames.add(host.name);
					} else {
						stillPendingHosts.push(host);
					}
				}

				if (currentHostLevel.length > 0) {
					levels.push(currentHostLevel);
				} else {
					// Cargar hosts restantes
					levels.push(stillPendingHosts.map(h => h.path));
					break;
				}

				pendingHosts = stillPendingHosts;
				hostIterations++;
			}
		}

		// Log de niveles para debug
		if (levels.length > 1) {
			this.#logger.logDebug(`Niveles de carga: ${levels.map((l, i) => `L${i}(${l.length})`).join(' -> ')}`);
		}

		return levels;
	}

	async #loadAndRegisterSpecificModule(moduleType: ModuleType, config: IModuleConfig): Promise<Module> {
		let module: Module;

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
		app.run().catch((e) => {
			this.#logger.logError(`Error ejecutando App ${app.name}: {}\nSe intentará ejecutarla de nuevo en 30 segundos...`, e.message);
			setTimeout(() => this.#initializeAndRunApp(app, filePath, instanceName, configPath), 30_000);
		});
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
			const appDir = configPath.includes(`${path.sep}configs${path.sep}`)
				? path.dirname(path.dirname(configPath))
				: path.dirname(configPath);
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
			const newApp: IApp = new AppClass(this, instanceName, config, appFilePath);
			await this.#initializeAndRunApp(newApp, appFilePath, instanceName, configPath);

			this.#logger.logOk(`Instancia recargada exitosamente: ${instanceName}`);
		} catch (error) {
			this.#logger.logError(`Error recargando instancia desde ${configPath}: ${error}`);
		}
	}

	/**
	 * Ejecuta docker-compose.yml si existe en el directorio de la app
	 */
	async #startDockerCompose(appDir: string, appName: string): Promise<void> {
		const dockerComposeFile = path.join(appDir, "docker-compose.yml");
		try {
			await fs.stat(dockerComposeFile);

			// Archivo existe, ejecutar docker-compose up -d
			this.#logger.logInfo(`Iniciando servicios Docker para app en ${appDir}...`);

			const { spawn } = await import("node:child_process");
			const docker = spawn("docker", ["compose", "-f", dockerComposeFile, "up", "-d"], {
				cwd: appDir,
				stdio: "pipe",
			});

			return new Promise((resolve, reject) => {
				let output = "";
				docker.stdout?.on("data", (data) => {
					output += data.toString();
				});
				docker.stderr?.on("data", (data) => {
					output += data.toString();
				});
				docker.on("close", (code) => {
					if (code === 0) {
						this.#logger.logOk("Servicios Docker iniciados");
						// Registrar que esta app tiene docker-compose
						this.#appDockerComposeMap.set(appName, appDir);
						// Esperar a que los servicios estén listos
						setTimeout(() => resolve(), 3000);
					} else {
						this.#logger.logWarn(`docker-compose falló con código ${code}`);
						reject(new Error(`docker-compose exit code: ${code}`));
					}
				});
			});
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				this.#logger.logWarn(`No se pudo ejecutar docker-compose: ${error.message}`);
			}
			// Si no existe el archivo, simplemente continuar
		}
	}

	/**
	 * Detiene docker-compose.yml en el directorio de la app
	 */
	async #stopDockerCompose(appDir: string): Promise<void> {
		const dockerComposeFile = path.join(appDir, "docker-compose.yml");
		try {
			await fs.stat(dockerComposeFile);

			this.#logger.logInfo(`Deteniendo servicios Docker para app en ${appDir}...`);

			const { spawn } = await import("node:child_process");
			const docker = spawn("docker", ["compose", "-f", dockerComposeFile, "down"], {
				cwd: appDir,
				stdio: "pipe",
			});

			return new Promise((resolve, reject) => {
				let output = "";
				docker.stdout?.on("data", (data) => {
					output += data.toString();
				});
				docker.stderr?.on("data", (data) => {
					output += data.toString();
				});
				docker.on("close", (code) => {
					if (code === 0) {
						this.#logger.logOk("Servicios Docker detenidos");
						resolve();
					} else {
						this.#logger.logWarn(`docker-compose down falló con código ${code}`);
						reject(new Error(`docker-compose exit code: ${code}`));
					}
				});
			});
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				this.#logger.logWarn(`No se pudo detener docker-compose: ${error.message}`);
			}
			// Si no existe el archivo, simplemente continuar
		}
	}

	async #loadApp(filePath: string): Promise<void> {
		try {
			const module = await import(`${filePath}?v=${Date.now()}`);
			const AppClass = module.default;
			if (!AppClass) return;

			const appDir = path.dirname(filePath);
			const appName = path.basename(appDir);

		// Verificar si la app está deshabilitada en default.json o config.json
		try {
			const defaultConfigPath = path.join(appDir, "default.json");
			const defaultConfigContent = await fs.readFile(defaultConfigPath, "utf-8");
			const defaultConfig = JSON.parse(defaultConfigContent);

			if (defaultConfig.disabled === true) {
				this.#logger.logDebug(`App ${appName} está deshabilitada (default.json)`);
				return; // No continuar con esta app
			}
		} catch (error) {
			// No hay default.json o no se puede leer, intentar config.json
		}

		// También verificar en config.json
		try {
			const configPath = path.join(appDir, "config.json");
			const configContent = await fs.readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);

			if (config.disabled === true) {
				this.#logger.logDebug(`App ${appName} está deshabilitada (config.json)`);
				return; // No continuar con esta app
			}
		} catch (error) {
			// No hay config.json o no se puede leer, continuar normalmente
		}

			// Ejecutar docker-compose si existe
			try {
				await this.#startDockerCompose(appDir, appName);
			} catch {
				this.#logger.logDebug(`docker-compose no disponible o no configurado para ${appName}`);
			}

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

					// Check if app is disabled
					if (config.disabled === true) {
						this.#logger.logDebug(`App ${appName} está deshabilitada (config: ${path.basename(configPath)})`);
						continue;
					}

					const configFile = path.basename(configPath);
					const configName = this.#getConfigName(configFile);
					const instanceName = `${appName}:${configName}`;

					const app: IApp = new AppClass(this, instanceName, config, filePath);
					await this.#initializeAndRunApp(app, filePath, instanceName, configPath);
				}
			} else {
				const app: IApp = new AppClass(this, appName, undefined, filePath);
				await this.#initializeAndRunApp(app, filePath, appName);
			}
		} catch (e: any) {
			if (e.code === "ERR_MODULE_NOT_FOUND") {
				this.#logger.logError(
					`Faltan dependencias de Node.js para la app en ${filePath}. Por favor, instálalas. Reintentando en 30 segundos...`
				);
				setTimeout(() => this.#loadApp(filePath), 30000);
			} else {
				this.#logger.logError(`Error ejecutando App ${filePath}: ${e}`);
			}
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
				return ["default.json", "tsonfig.json"].includes(path.basename(filePath));
			},
			awaitWriteFinish: {
				stabilityThreshold: 2000,
				pollInterval: 100,
			},
		});

		watcher.on("change", async (srcConfigPath) => {
			if (this.#isStartingUp) return;
			this.#logger.logInfo(`Detectado cambio en configuración: ${path.basename(srcConfigPath)}`);
			await this.#reloadAppInstance(srcConfigPath);
		});

		watcher.on("add", async (srcConfigPath) => {
			if (this.#isStartingUp) return;

			// Cuando se agrega un nuevo archivo de configuración, necesitamos cargar la app completa
			// para crear la nueva instancia
			const appDirResolved = srcConfigPath.includes("/configs/") ? path.dirname(path.dirname(srcConfigPath)) : path.dirname(srcConfigPath);
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
			const module = registry.get(uniqueKey) as Module;
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
