import * as path from "node:path";
import * as fs from "node:fs/promises";
import { spawn, ChildProcess } from "node:child_process";
import { IModuleLoader } from "../../../interfaces/modules/IModuleLoader.js";
import { IModuleConfig } from "../../../interfaces/modules/IModule.js";
import { IProvider } from "../../../interfaces/modules/IProvider.js";
import { IService } from "../../../interfaces/modules/IService.js";
import { IUtility } from "../../../interfaces/modules/IUtility.js";
import { Kernel } from "../../../kernel.js";
import { Logger } from "../../logger/Logger.js";
import { ipcManager } from "../../ipc/IPCManager.js";

/**
 * Wrapper para módulos Python que se comunican via IPC
 */
class PythonModuleWrapper {
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
			Logger.info(`[PythonModuleWrapper] Proceso Python detenido: ${this.name}`);
		}
	}
}

/**
 * Provider wrapper para Python
 */
class PythonProviderWrapper extends PythonModuleWrapper implements IProvider<any> {
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
							return await ipcManager.call(this.name, this.moduleVersion, "python", prop, args);
						};
					}
					return undefined;
				},
			}
		);
	}
}

/**
 * Utility wrapper para Python
 */
class PythonUtilityWrapper extends PythonModuleWrapper implements IUtility<any> {
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
							return await ipcManager.call(this.name, this.moduleVersion, "python", prop, args);
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
 * Service wrapper para Python
 */
class PythonServiceWrapper extends PythonModuleWrapper implements IService<any> {
	async start(): Promise<void> {
		Logger.info(`[PythonServiceWrapper] Iniciando servicio Python: ${this.name}`);
	}

	async getInstance(): Promise<any> {
		return new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (typeof prop === "string") {
						return async (...args: any[]) => {
							return await ipcManager.call(this.name, this.moduleVersion, "python", prop, args);
						};
					}
					return undefined;
				},
			}
		);
	}
}

/**
 * Loader para módulos Python.
 * Inicia procesos Python y se comunica con ellos mediante IPC (named pipes).
 */
export class PythonLoader implements IModuleLoader {
	private processes = new Map<string, ChildProcess>();

	async canHandle(modulePath: string): Promise<boolean> {
		try {
			const indexFile = path.join(modulePath, "index.py");
			await fs.stat(indexFile);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Inicia un proceso Python para el módulo y configura el servidor IPC
	 */
	private async startPythonProcess(
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

		const indexFile = path.join(modulePath, "index.py");

		// Preparar el entorno y argumentos para el proceso Python
		// Determinar el path base según el entorno
		const basePath = process.env.NODE_ENV === "development" ? "src" : "dist";
		const pythonPath = path.resolve(process.cwd(), basePath, "interfaces", "interop", "py");

		const env = {
			...process.env,
			ADC_MODULE_NAME: moduleName,
			ADC_MODULE_VERSION: moduleVersion,
			ADC_MODULE_TYPE: moduleType,
			ADC_MODULE_CONFIG: config ? JSON.stringify(config) : "{}",
			PYTHONPATH: pythonPath,
		};

		Logger.debug(`[PythonLoader] Iniciando proceso Python: ${indexFile}`);
		Logger.debug(`[PythonLoader] PYTHONPATH: ${pythonPath}`);

		const pythonProcess = spawn("python3", [indexFile], {
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Helper para parsear y loguear mensajes con el nivel correcto
		const logPythonMessage = (data: Buffer) => {
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
						Logger.debug(`[Python:${moduleName}] ${rest}`);
						break;
					case "INFO":
						Logger.info(`[Python:${moduleName}] ${rest}`);
						break;
					case "OK":
						Logger.ok(`[Python:${moduleName}] ${rest}`);
						break;
					case "WARN":
						Logger.warn(`[Python:${moduleName}] ${rest}`);
						break;
					case "ERROR":
						Logger.error(`[Python:${moduleName}] ${rest}`);
						break;
					default:
						Logger.info(`[Python:${moduleName}] ${message}`);
				}
			} else {
				// Si no hay nivel explícito, loguear como info
				Logger.info(`[Python:${moduleName}] ${message}`);
			}
		};

		// Capturar salida estándar y de errores (ambos van a stderr desde Python)
		pythonProcess.stdout?.on("data", (data) => {
			logPythonMessage(data);
		});

		pythonProcess.stderr?.on("data", (data) => {
			logPythonMessage(data);
		});

		// Manejar salida del proceso
		pythonProcess.on("exit", (code) => {
			Logger.warn(`[PythonLoader] Proceso Python terminado: ${moduleName} (código: ${code})`);
			this.processes.delete(processKey);
		});

		// Guardar el proceso
		this.processes.set(processKey, pythonProcess);

		// Esperar un momento para que el proceso Python inicie el servidor IPC
		await new Promise((resolve) => setTimeout(resolve, 1000));

		return pythonProcess;
	}

	async loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider<any>> {
		try {
			// Extraer información del módulo del path o config
			const moduleName = config?.moduleName || path.basename(modulePath);
			const moduleVersion = config?.moduleVersion || "1.0.0";
			const moduleType = config?.type;

			Logger.debug(`[PythonLoader] Cargando Provider Python: ${moduleName}@${moduleVersion}`);

			// Iniciar el proceso Python
			const pythonProcess = await this.startPythonProcess(modulePath, moduleName, moduleVersion, "provider", config);

			// Crear el wrapper del provider
			return new PythonProviderWrapper(moduleName, modulePath, moduleVersion, moduleType, config, pythonProcess);
		} catch (error) {
			Logger.error(`[PythonLoader] Error cargando Provider: ${error}`);
			throw error;
		}
	}

	async loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility<any>> {
		try {
			const moduleName = config?.moduleName || path.basename(modulePath);
			const moduleVersion = config?.moduleVersion || "1.0.0";

			Logger.debug(`[PythonLoader] Cargando Utility Python: ${moduleName}@${moduleVersion}`);

			// Iniciar el proceso Python
			const pythonProcess = await this.startPythonProcess(modulePath, moduleName, moduleVersion, "utility", config);

			// Crear el wrapper del utility
			return new PythonUtilityWrapper(moduleName, modulePath, moduleVersion, config, pythonProcess);
		} catch (error) {
			Logger.error(`[PythonLoader] Error cargando Utility: ${error}`);
			throw error;
		}
	}

	async loadService(modulePath: string, _kernel: Kernel, config?: Record<string, any> | IModuleConfig): Promise<IService<any>> {
		try {
			const moduleConfig = config as IModuleConfig;
			const moduleName = moduleConfig?.name || path.basename(modulePath);
			const moduleVersion = moduleConfig?.version || "1.0.0";

			Logger.debug(`[PythonLoader] Cargando Service Python: ${moduleName}@${moduleVersion}`);

			// Iniciar el proceso Python
			const pythonProcess = await this.startPythonProcess(modulePath, moduleName, moduleVersion, "service", moduleConfig?.config);

			// Crear el wrapper del service
			return new PythonServiceWrapper(moduleName, modulePath, moduleVersion, moduleConfig?.config, pythonProcess);
		} catch (error) {
			Logger.error(`[PythonLoader] Error cargando Service: ${error}`);
			throw error;
		}
	}

	/**
	 * Detiene todos los procesos Python
	 */
	async stopAll(): Promise<void> {
		for (const [key, process] of this.processes) {
			if (!process.killed) {
				process.kill();
				Logger.info(`[PythonLoader] Proceso Python detenido: ${key}`);
			}
		}
		this.processes.clear();
	}
}

export default PythonLoader;
