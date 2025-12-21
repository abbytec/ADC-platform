import * as path from "node:path";
import { promises as fs } from "node:fs";
import { LoaderManager } from "./LoaderManager.js";
import { IModuleConfig } from "../../interfaces/modules/IModule.js";
import type { BaseProvider } from "../../providers/BaseProvider.ts";
import type { IUtility } from "../../utilities/BaseUtility.ts";
import type { BaseService } from "../../services/BaseService.ts";
import { Kernel } from "../../kernel.js";
import { Logger } from "../logger/Logger.js";
import { VersionResolver } from "../VersionResolver.js";

export class ModuleLoader {
	readonly #basePath = path.resolve(process.cwd(), "src");

	readonly #providersPath = path.resolve(this.#basePath, "providers");
	readonly #utilitiesPath = path.resolve(this.#basePath, "utilities");
	readonly #servicesPath = path.resolve(this.#basePath, "services");

	readonly #configCache = new Map<string, IModuleConfig>();

	readonly #kernelKey: symbol;

	readonly #loaderManager: LoaderManager;

	constructor(kernelKey: symbol) {
		this.#kernelKey = kernelKey;
		this.#loaderManager = new LoaderManager(this.#kernelKey);
	}

	public getConfigByPath(modulePath: string): IModuleConfig | undefined {
		return this.#configCache.get(modulePath);
	}

	/**
	 * Carga todos los módulos (providers, utilities, services) desde un objeto de definición de módulos.
	 * Usa el contexto de carga del kernel para reference counting.
	 * @param modulesConfig - El objeto de definición de módulos.
	 * @param kernel - La instancia del kernel.
	 */
	#globalConfigs: {
		providers: IModuleConfig[];
		utilities: IModuleConfig[];
	} = { providers: [], utilities: [] };

	/**
	 * Procesa y almacena las configuraciones globales de la definición de módulos.
	 * @param modulesConfig - El objeto de definición de módulos.
	 */
	#processGlobalConfigs(modulesConfig: IModuleConfig): void {
		this.#globalConfigs = { providers: [], utilities: [] }; // Reset

		const process = (configs: IModuleConfig[] = [], type: "providers" | "utilities") => {
			for (const config of configs) {
				if (config.global) {
					this.#globalConfigs[type].push(config);
				}
			}
		};

		process(modulesConfig.providers, "providers");
		process(modulesConfig.utilities, "utilities");
	}

	/**
	 * Interpola variables de entorno en un objeto de configuración
	 * Reemplaza ${VAR_NAME} con el valor de process.env.VAR_NAME
	 */
	#interpolateEnvVars(obj: any): any {
		if (typeof obj === "string") {
			return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
				return process.env[varName] || "";
			});
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.#interpolateEnvVars(item));
		}

		if (obj && typeof obj === "object") {
			const result: any = {};
			for (const [key, value] of Object.entries(obj)) {
				result[key] = this.#interpolateEnvVars(value);
			}
			return result;
		}

		return obj;
	}

	async loadAllModulesFromDefinition(modulesConfig: IModuleConfig, kernel: Kernel): Promise<void> {
		this.#processGlobalConfigs(modulesConfig); // Procesar globales primero

		try {
			// Cargar providers globales (NO se registran como dependencias de la app)
			// Solo se registran como dependencias cuando un servicio los usa
			if (modulesConfig.providers && Array.isArray(modulesConfig.providers)) {
				for (const providerConfig of modulesConfig.providers) {
					// Verificar si el provider ya existe antes de cargarlo
					if (kernel.hasModule("provider", providerConfig.name, providerConfig.config)) {
						Logger.debug(`[ModuleLoader] Provider global ${providerConfig.name} ya existe, saltando`);
						continue;
					}
					try {
						const provider = await this.loadProvider(providerConfig);
						// Pasar null como appName para que NO se registre como dependencia de la app actual
						// Registrar por el nombre de la clase del provider
						kernel.registerProvider(provider.name, provider, provider.type, providerConfig, null);

						// También registrar por el nombre del módulo/configuración para que sea encontrable
						if (providerConfig.name !== provider.name) {
							// Crear una clave única basada en el nombre del módulo
							const moduleNameKey = `${providerConfig.name}`;
							// Registrar el provider también por este nombre
							kernel.registerProvider(moduleNameKey, provider, undefined, providerConfig, null);
						}
					} catch (error) {
						const message = `Error cargando provider ${providerConfig.name}: ${error}`;
						if (modulesConfig.failOnError) throw new Error(message);
						Logger.warn(message);
					}
				}
			}

			// Cargar utilities globales (NO se registran como dependencias de la app)
			if (modulesConfig.utilities && Array.isArray(modulesConfig.utilities)) {
				for (const utilityConfig of modulesConfig.utilities) {
					try {
						const utility = await this.loadUtility(utilityConfig);
						// Pasar null como appName para que NO se registre como dependencia de la app actual
						kernel.registerUtility(utility.name, utility, utilityConfig, null);

						// Si el nombre contiene "/", también registrar con el nombre base como alias
						if (utilityConfig.name.includes("/")) {
							const baseName = utilityConfig.name.split("/").pop()!;
							kernel.registerUtility(baseName, utility, utilityConfig, null);
						}
					} catch (error) {
						const message = `Error cargando utility ${utilityConfig.name}: ${error}`;
						if (modulesConfig.failOnError) throw new Error(message);
						Logger.warn(message);
					}
				}
			}

			// Cargar services
			if (modulesConfig.services && Array.isArray(modulesConfig.services)) {
				for (const serviceConfig of modulesConfig.services) {
					try {
						// Clonar la configuración para poder mutarla, ya que el original está congelado
						const mutableServiceConfig = structuredClone(serviceConfig);

						// PRIMERO: Calcular el uniqueKey para verificar si el servicio ya existe
						// Necesitamos resolver los providers para construir el config correcto
						let finalProviders = mutableServiceConfig.providers;
						if (!finalProviders || finalProviders.length === 0) {
							try {
								const resolved = await VersionResolver.resolveModuleVersion(
									this.#servicesPath,
									serviceConfig.name,
									serviceConfig.version,
									serviceConfig.language
								);
								if (resolved) {
									const configJsonPath = path.join(path.dirname(resolved.path), "config.json");
									const configContent = await fs.readFile(configJsonPath, "utf-8");
									const configJson = JSON.parse(configContent);
									if (configJson.providers && Array.isArray(configJson.providers)) {
										finalProviders = configJson.providers;
									}
								}
							} catch {
								// Si no se puede leer, usar el array vacío
							}
						}

						// Construir el config que se usará para el uniqueKey
						const serviceUniqueConfig = {
							...serviceConfig.config,
							__providers: finalProviders,
						};

						// VERIFICAR si el servicio ya existe antes de cargarlo
						if (kernel.hasModule("service", serviceConfig.name, serviceUniqueConfig)) {
							Logger.debug(`[ModuleLoader] Servicio ${serviceConfig.name} ya existe, reutilizando instancia`);
							// Solo agregar la dependencia a la app actual (el kernel lo maneja internamente)
							kernel.addModuleDependency("service", serviceConfig.name, serviceUniqueConfig);
							continue; // Saltar al siguiente servicio
						}

						// SEGUNDO: Cargar los providers específicos del servicio (si los tiene)
						// Esto evita duplicación porque los providers se cargan una sola vez en el kernel
						if (mutableServiceConfig.providers && Array.isArray(mutableServiceConfig.providers)) {
							for (const providerConfig of mutableServiceConfig.providers) {
								// Solo cargar si no es global (los globales ya fueron cargados)
								if (!providerConfig.global) {
									// Verificar si el provider ya existe
									if (kernel.hasModule("provider", providerConfig.name, providerConfig.config)) {
										Logger.debug(`[ModuleLoader] Provider ${providerConfig.name} ya existe, reutilizando`);
										kernel.addModuleDependency("provider", providerConfig.name, providerConfig.config);
										continue;
									}
									try {
										const provider = await this.loadProvider(providerConfig);
										kernel.registerProvider(provider.name, provider, provider.type, providerConfig);

										// También registrar por el nombre del módulo/configuración
										if (providerConfig.name !== provider.name) {
											kernel.registerProvider(providerConfig.name, provider, undefined, providerConfig);
										}
									} catch (error) {
										const message = `Error cargando provider ${providerConfig.name} del servicio ${serviceConfig.name}: ${error}`;
										if (modulesConfig.failOnError) throw new Error(message);
										Logger.warn(message);
									}
								}
							}
						}

						// Cargar utilities específicas del servicio (si las tiene)
						if (mutableServiceConfig.utilities && Array.isArray(mutableServiceConfig.utilities)) {
							Logger.debug(
								`[ModuleLoader] Cargando ${mutableServiceConfig.utilities.length} utilities para servicio ${serviceConfig.name}`
							);
							for (const utilityConfig of mutableServiceConfig.utilities) {
								Logger.debug(`[ModuleLoader] Utility '${utilityConfig.name}' - global: ${utilityConfig.global}`);
								if (utilityConfig.global) {
									Logger.debug(`[ModuleLoader] Saltando utility global: ${utilityConfig.name}`);
								} else {
									try {
										const utility = await this.loadUtility(utilityConfig);
										kernel.registerUtility(utility.name, utility, utilityConfig);

										// Si el nombre contiene "/", también registrar con el nombre base como alias
										if (utilityConfig.name.includes("/")) {
											const baseName = utilityConfig.name.split("/").pop()!;
											Logger.debug(`[ModuleLoader] Registrando alias '${baseName}' para utility '${utilityConfig.name}'`);
											kernel.registerUtility(baseName, utility, utilityConfig);
										}
									} catch (error) {
										const message = `Error cargando utility ${utilityConfig.name} del servicio ${serviceConfig.name}: ${error}`;
										if (modulesConfig.failOnError) throw new Error(message);
										Logger.warn(message);
									}
								}
							}
						}

						// TERCERO: Cargar el servicio (que ahora puede acceder a sus providers del kernel)
						const service = await this.loadService(mutableServiceConfig, kernel);
						if (service.start) {
							try {
								service.setKernelKey(this.#kernelKey);
							} catch {
								//no-op
							}

							await service.start(this.#kernelKey);
						}

						// CUARTO: Registrar los providers del servicio como dependencias de la app
						// Esto es necesario para el reference counting correcto
						if (mutableServiceConfig.providers && Array.isArray(mutableServiceConfig.providers)) {
							for (const providerConfig of mutableServiceConfig.providers) {
								// Agregar el provider como dependencia de la app actual
								// Esto incrementa el reference count y lo añade a appModuleDependencies
								// addModuleDependency también maneja automáticamente los aliases (type)
								kernel.addModuleDependency("provider", providerConfig.name, providerConfig.config);
							}
						}

						// QUINTO: Registrar el servicio con el config que incluye providers
						const registrationConfig: IModuleConfig = {
							name: serviceConfig.name,
							version: serviceConfig.version,
							language: serviceConfig.language,
							config: serviceUniqueConfig,
						};
						kernel.registerService(service.name, service, registrationConfig);
					} catch (error) {
						const message = `Error cargando service ${serviceConfig.name}: ${error}`;
						if (modulesConfig.failOnError) throw new Error(message);
						Logger.warn(message);
					}
				}
			}
		} catch (error) {
			const message = `Error procesando la definición de módulos: ${error}`;
			Logger.error(message);
			throw new Error(message);
		}
	}

	/**
	 * Carga un Provider desde su configuración.
	 */
	async loadProvider(config: IModuleConfig): Promise<BaseProvider> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Provider: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#providersPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Provider: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = this.#loaderManager.getLoader(language);

		// Interpolar variables de entorno en todas las propiedades del config
		const interpolatedConfig = this.#interpolateEnvVars(config);

		// Enriquecer config con información del módulo para interoperabilidad
		// Incluir tanto custom como options y cualquier otra propiedad
		const enrichedConfig = {
			...interpolatedConfig.custom,
			...interpolatedConfig.options,
			...interpolatedConfig.config,
			moduleName: interpolatedConfig.name,
			moduleVersion: resolved.version,
			language: language,
			type: interpolatedConfig.type,
		};

		// Cargar el módulo
		return await loader.loadProvider(resolved.path, enrichedConfig);
	}

	/**
	 * Carga un Utility desde su configuración.
	 */
	async loadUtility(config: IModuleConfig): Promise<IUtility> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Utility: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#utilitiesPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Utility: ${config.name}@${version} (${language})`);
		}
		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = this.#loaderManager.getLoader(language);

		// Interpolar variables de entorno
		const interpolatedConfig = this.#interpolateEnvVars(config);

		// Enriquecer config con información del módulo
		const enrichedConfig = {
			...interpolatedConfig.custom,
			...interpolatedConfig.options,
			...interpolatedConfig.config,
			moduleName: interpolatedConfig.name,
			moduleVersion: resolved.version,
			language: language,
			type: interpolatedConfig.type,
		};

		// Cargar el módulo
		return await loader.loadUtility(resolved.path, enrichedConfig);
	}

	/**
	 * Carga un Service desde su configuración.
	 */
	async loadService(config: IModuleConfig, kernel: Kernel): Promise<BaseService> {
		const language = config.language || "typescript";
		const version = config.version || "latest";

		Logger.debug(`[ModuleLoader] Cargando Service: ${config.name} (v${version}, ${language})`);

		// Resolver la versión correcta
		const resolved = await VersionResolver.resolveModuleVersion(this.#servicesPath, config.name, version, language);

		if (!resolved) {
			throw new Error(`No se pudo resolver Service: ${config.name}@${version} (${language})`);
		}

		this.#configCache.set(resolved.path, config);

		// Obtener el loader correcto
		const loader = this.#loaderManager.getLoader(language);

		// Interpolar variables de entorno
		const interpolatedConfig = this.#interpolateEnvVars(config);

		// Enriquecer config con información del módulo
		const enrichedConfig = {
			...interpolatedConfig.custom,
			...interpolatedConfig.options,
			...interpolatedConfig.config,
			moduleName: interpolatedConfig.name,
			moduleVersion: resolved.version,
			language: language,
			type: interpolatedConfig.type,
		};

		// Cargar el módulo (los services reciben kernel + config)
		return await loader.loadService(resolved.path, kernel, enrichedConfig);
	}
}
