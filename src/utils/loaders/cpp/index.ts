import * as path from "node:path";
import * as fs from "node:fs/promises";
import { spawn, ChildProcess, exec } from "node:child_process";
import { IModuleLoader } from "../../../interfaces/modules/IModuleLoader.js";
import { IModuleConfig } from "../../../interfaces/modules/IModule.js";
import { IProvider } from "../../../interfaces/modules/IProvider.js";
import { IService } from "../../../interfaces/modules/IService.js";
import { IUtility } from "../../../interfaces/modules/IUtility.js";
import { Kernel } from "../../../kernel.js";
import { Logger } from "../../logger/Logger.js";
import { ipcManager } from "../../ipc/IPCManager.js";

/**
 * Wrapper para módulos C++ que se comunican via IPC
 */
class CppModuleWrapper {
	constructor(
		public readonly name: string,
		public readonly modulePath: string,
		public readonly moduleVersion: string,
		public readonly config?: Record<string, any>,
		private readonly process?: ChildProcess
	) {}

	async stop(): Promise<void> {
		if (this.process && !this.process.killed) {
			this.process.kill();
			Logger.info(`[CppModuleWrapper] Proceso C++ detenido: ${this.name}`);
		}
	}
}

/**
 * Provider wrapper para C++
 */
class CppProviderWrapper extends CppModuleWrapper implements IProvider<any> {
	readonly type: string;

	constructor(
		name: string,
		modulePath: string,
		moduleVersion: string,
		type: string | undefined,
		config?: Record<string, any>,
		process?: ChildProcess
	) {
		super(name, modulePath, moduleVersion, config, process);
		this.type = type || "default";
	}

	async getInstance(): Promise<any> {
		// El proxy se encargará de enrutar las llamadas via IPC
		return new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (typeof prop === "string") {
						return async (...args: any[]) => {
							return await ipcManager.call(this.name, this.moduleVersion, "C++", prop, args);
						};
					}
					return undefined;
				},
			}
		);
	}
}

/**
 * Utility wrapper para C++
 */
class CppUtilityWrapper extends CppModuleWrapper implements IUtility<any> {
	private cachedInstance: any = null;

	async getInstance(): Promise<any> {
		if (this.cachedInstance) {
			return this.cachedInstance;
		}

		this.cachedInstance = new Proxy(
			{},
			{
				get: (_target, prop) => {
					// Ignorar propiedades de Promise y símbolos especiales
					if (typeof prop === "symbol" || prop === "then" || prop === "catch" || prop === "finally") {
						return undefined;
					}

					if (typeof prop === "string") {
						// Crear una función que hace la llamada IPC
						return async (...args: any[]) => {
							return await ipcManager.call(this.name, this.moduleVersion, "C++", prop, args);
						};
					}
					return undefined;
				},
			}
		);

		return this.cachedInstance;
	}
}

/**
 * Service wrapper para C++
 */
class CppServiceWrapper extends CppModuleWrapper implements IService<any> {
	async start(): Promise<void> {
		Logger.info(`[CppServiceWrapper] Iniciando servicio C++: ${this.name}`);
	}

	async getInstance(): Promise<any> {
		return new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (typeof prop === "string") {
						return async (...args: any[]) => {
							return await ipcManager.call(this.name, this.moduleVersion, "C++", prop, args);
						};
					}
					return undefined;
				},
			}
		);
	}
}

/**
 * Loader para módulos C++.
 * Inicia procesos C++ y se comunica con ellos mediante IPC (named pipes).
 */
export class CppLoader implements IModuleLoader {
	private processes = new Map<string, ChildProcess>();

	async canHandle(modulePath: string): Promise<boolean> {
		try {
			const indexFile = path.join(modulePath, "index.cpp");
			await fs.stat(indexFile);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Inicia un proceso C++ para el módulo y configura el servidor IPC
	 */
	private async startCppProcess(
		modulePath: string,
		moduleName: string,
		moduleVersion: string,
		moduleType: "provider" | "utility" | "service",
		config?: Record<string, any>
	): Promise<ChildProcess> {
		const processKey = `${moduleName}-${moduleVersion}`;

		// Si ya existe un proceso para este módulo, reutilizarlo
		if (this.processes.has(processKey)) {
			return this.processes.get(processKey)!;
		}

		const indexFile = path.join(modulePath, "index.cpp");

		// Preparar el entorno y argumentos para el proceso C++
		// Determinar el path base según el entorno
		const basePath = process.env.NODE_ENV === "development" ? "src" : "dist";
		const cppPath = path.resolve(process.cwd(), basePath, "interfaces", "interop", "cpp");

		const env = {
			...process.env,
			ADC_MODULE_NAME: moduleName,
			ADC_MODULE_VERSION: moduleVersion,
			ADC_MODULE_TYPE: moduleType,
			ADC_MODULE_CONFIG: config ? JSON.stringify(config) : "{}",
			CPPPATH: cppPath,
		};

		Logger.debug(`[CppLoader] Iniciando proceso C++: ${indexFile}`);
		Logger.debug(`[CppLoader] CPPPATH: ${cppPath}`);

		exec(`cmake ${modulePath} -B ../../../../temp/builds/${moduleType}/${moduleName}`, (error, stdout, _stderr) => {
			if (error) return Logger.error("Error:", error);
			Logger.debug("Salida:", stdout);
		});

		const cppProcess = spawn(`../../../../temp/builds/${moduleType}/${moduleName}/index`, [], {
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Helper para parsear y loguear mensajes con el nivel correcto
		const logCppMessage = (data: Buffer) => {
			const message = data.toString().trim();
			if (!message) return;

			// Intentar parsear el nivel de log del formato: [NIVEL] [módulo] mensaje
			const levelMatch = message.match(/^\[(DEBUG|INFO|OK|WARN|ERROR)\]\s+(.*)/i);

			if (levelMatch) {
				const level = levelMatch[1].toUpperCase();
				const rest = levelMatch[2];

				// Loguear con el nivel correcto
				switch (level) {
					case "DEBUG":
						Logger.debug(`[Cpp:${moduleName}] ${rest}`);
						break;
					case "INFO":
						Logger.info(`[Cpp:${moduleName}] ${rest}`);
						break;
					case "OK":
						Logger.ok(`[Cpp:${moduleName}] ${rest}`);
						break;
					case "WARN":
						Logger.warn(`[Cpp:${moduleName}] ${rest}`);
						break;
					case "ERROR":
						Logger.error(`[Cpp:${moduleName}] ${rest}`);
						break;
					default:
						Logger.info(`[Cpp:${moduleName}] ${message}`);
				}
			} else {
				// Si no hay nivel explícito, loguear como info
				Logger.info(`[Cpp:${moduleName}] ${message}`);
			}
		};

		// Capturar salida estándar y de errores (ambos van a stderr desde C++)
		cppProcess.stdout?.on("data", (data) => {
			logCppMessage(data);
		});

		cppProcess.stderr?.on("data", (data) => {
			logCppMessage(data);
		});

		// Manejar salida del proceso
		cppProcess.on("exit", (code) => {
			Logger.warn(`[CppLoader] Proceso C++ terminado: ${moduleName} (código: ${code})`);
			this.processes.delete(processKey);
		});

		// Guardar el proceso
		this.processes.set(processKey, cppProcess);

		// Esperar un momento para que el proceso C++ inicie el servidor IPC
		await new Promise((resolve) => setTimeout(resolve, 1000));

		return cppProcess;
	}

	async loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>> {
		try {
			// Extraer información del módulo del path o config
			const moduleName = config?.moduleName || path.basename(modulePath);
			const moduleVersion = config?.moduleVersion || "1.0.0";
			const moduleType = config?.type;

			Logger.debug(`[CppLoader] Cargando Provider C++: ${moduleName}@${moduleVersion}`);

			// Iniciar el proceso C++
			const cppProcess = await this.startCppProcess(modulePath, moduleName, moduleVersion, "provider", config);

			// Crear el wrapper del provider
			return new CppProviderWrapper(moduleName, modulePath, moduleVersion, moduleType, config, cppProcess);
		} catch (error) {
			Logger.error(`[CppLoader] Error cargando Provider: ${error}`);
			throw error;
		}
	}

	async loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility<any>> {
		try {
			const moduleName = config?.moduleName || path.basename(modulePath);
			const moduleVersion = config?.moduleVersion || "1.0.0";

			Logger.debug(`[CppLoader] Cargando Utility C++: ${moduleName}@${moduleVersion}`);

			// Iniciar el proceso C++
			const cppProcess = await this.startCppProcess(modulePath, moduleName, moduleVersion, "utility", config);

			// Crear el wrapper del utility
			return new CppUtilityWrapper(moduleName, modulePath, moduleVersion, config, cppProcess);
		} catch (error) {
			Logger.error(`[CppLoader] Error cargando Utility: ${error}`);
			throw error;
		}
	}

	async loadService(modulePath: string, _kernel: Kernel, config?: Record<string, any> | IModuleConfig): Promise<IService<any>> {
		try {
			const moduleConfig = config as IModuleConfig;
			const moduleName = moduleConfig?.name || path.basename(modulePath);
			const moduleVersion = moduleConfig?.version || "1.0.0";

			Logger.debug(`[CppLoader] Cargando Service C++: ${moduleName}@${moduleVersion}`);

			// Iniciar el proceso C++
			const cppProcess = await this.startCppProcess(modulePath, moduleName, moduleVersion, "service", moduleConfig?.config);

			// Crear el wrapper del service
			return new CppServiceWrapper(moduleName, modulePath, moduleVersion, moduleConfig?.config, cppProcess);
		} catch (error) {
			Logger.error(`[CppLoader] Error cargando Service: ${error}`);
			throw error;
		}
	}

	/**
	 * Detiene todos los procesos C++
	 */
	async stopAll(): Promise<void> {
		for (const [key, process] of this.processes) {
			if (!process.killed) {
				process.kill();
				Logger.info(`[CppLoader] Proceso C++ detenido: ${key}`);
			}
		}
		this.processes.clear();
	}
}

export default CppLoader;
