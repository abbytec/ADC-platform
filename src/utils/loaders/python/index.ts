import * as path from "node:path";
import * as fs from "node:fs/promises";
import { spawn, ChildProcess } from "node:child_process";
import { IModuleLoader } from "../../../interfaces/modules/IModuleLoader.js";
import { IModuleConfig } from "../../../interfaces/modules/IModule.js";

import { Kernel } from "../../../kernel.js";
import { Logger } from "../../logger/Logger.js";
import { ipcManager } from "../../ipc/IPCManager.js";
import type { IProvider } from "../../../providers/BaseProvider.ts";
import type { IUtility } from "../../../utilities/BaseUtility.ts";
import type { IService } from "../../../services/BaseService.ts";

type ModuleRole = "provider" | "utility" | "service";

interface PythonModuleOptions {
	name: string;
	modulePath: string;
	version: string;
	role: ModuleRole;
	config?: Record<string, any>;
	process: ChildProcess;
}

/**
 * Wrapper Unificado para módulos Python. */
class PythonModuleWrapper implements IProvider, IUtility, IService {
	public readonly name: string;
	public readonly modulePath: string;
	public readonly version: string;
	public readonly role: ModuleRole;
	private readonly process: ChildProcess;
	private readonly config?: Record<string, any>;

	// Cache para Singleton (Utility)
	private cachedInstance: any = null;

	constructor(options: PythonModuleOptions) {
		this.name = options.name;
		this.modulePath = options.modulePath;
		this.version = options.version;
		this.role = options.role;
		this.config = options.config;
		this.process = options.process;
	}

	get type(): string {
		return this.config?.type || "default";
	}

	async start(): Promise<void> {
		Logger.info(`[PythonModuleWrapper] Solicitando inicio remoto (start) a: ${this.name}`);
		await ipcManager.call(this.name, this.version, "python", "on_start", []);
	}

	async getInstance(): Promise<any> {
		// Si es Utility, usamos patrón Singleton (cache)
		if (this.role === "utility") {
			if (!this.cachedInstance) {
				this.cachedInstance = this.createIpcProxy();
			}
			return this.cachedInstance;
		}

		// Para Provider y Service devolvemos el proxy directo
		return this.createIpcProxy();
	}

	async stop(): Promise<void> {
		if (this.process && !this.process.killed) {
			this.process.kill();
			Logger.info(`[PythonModuleWrapper] Proceso detenido: ${this.name} (${this.role})`);
		}
	}

	/**
	 * Crea el Proxy para interceptar llamadas y enviarlas por IPC
	 */
	private createIpcProxy(): any {
		return new Proxy(
			{},
			{
				get: (_target, prop) => {
					// Ignorar promesas y serialización
					if (typeof prop === "symbol" || ["then", "catch", "finally", "toJSON"].includes(prop as string)) {
						return undefined;
					}

					return async (...args: any[]) => {
						return await ipcManager.call(this.name, this.version, "python", prop as string, args);
					};
				},
			}
		);
	}
}

/**
 * Loader optimizado con gestión de ciclo de vida ordenado.
 */
export class PythonLoader implements IModuleLoader {
	// Almacenamos los wrappers clasificados para poder detenerlos en orden
	private modules = {
		provider: [] as PythonModuleWrapper[],
		utility: [] as PythonModuleWrapper[],
		service: [] as PythonModuleWrapper[],
	};

	async canHandle(modulePath: string): Promise<boolean> {
		try {
			await fs.stat(path.join(modulePath, "index.py"));
			return true;
		} catch {
			return false;
		}
	}

	async loadProvider(modulePath: string, config?: Record<string, any>): Promise<IProvider> {
		return this.loadModule(modulePath, "provider", config);
	}

	async loadUtility(modulePath: string, config?: Record<string, any>): Promise<IUtility> {
		return this.loadModule(modulePath, "utility", config);
	}

	// Normalizamos la config si viene de IModuleConfig
	async loadService(modulePath: string, _kernel: Kernel, config?: IModuleConfig): Promise<IService> {
		const actualConfig = config?.config || (config as Record<string, any>);
		const wrapper = await this.loadModule(modulePath, "service", actualConfig, config);
		return wrapper;
	}

	/**
	 * Método centralizado para cargar cualquier tipo de módulo
	 */
	private async loadModule(
		modulePath: string,
		role: ModuleRole,
		config?: Record<string, any>,
		rawModuleConfig?: IModuleConfig
	): Promise<PythonModuleWrapper> {
		const name = rawModuleConfig?.name || config?.moduleName || path.basename(modulePath);
		const version = rawModuleConfig?.version || config?.moduleVersion || "1.0.0";

		Logger.debug(`[PythonLoader] Cargando ${role}: ${name}@${version}`);

		const process = await this.startPythonProcess(modulePath, name, version, role, config);

		const wrapper = new PythonModuleWrapper({
			name,
			modulePath,
			version,
			role,
			config,
			process,
		});

		// Guardamos la referencia en la lista correspondiente
		this.modules[role].push(wrapper);

		return wrapper;
	}

	private async startPythonProcess(
		modulePath: string,
		moduleName: string,
		moduleVersion: string,
		moduleType: string,
		config?: Record<string, any>
	): Promise<ChildProcess> {
		const indexFile = path.join(modulePath, "index.py");
		const basePath = process.env.NODE_ENV === "development" ? "src" : "dist";
		const pythonPath = path.resolve(process.cwd(), basePath, "interfaces", "interop", "py");

		const env = {
			...process.env,
			ADC_MODULE_NAME: moduleName,
			ADC_MODULE_VERSION: moduleVersion,
			ADC_MODULE_TYPE: moduleType,
			ADC_MODULE_CONFIG: JSON.stringify(config || {}),
			PYTHONPATH: pythonPath,
		};

		const pythonProcess = spawn("python3", [indexFile], {
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		this.setupProcessLogging(pythonProcess, moduleName);

		// Manejo de salida inesperada
		pythonProcess.on("exit", (code) => {
			if (code !== 0 && code !== null) {
				Logger.warn(`[PythonLoader] Proceso ${moduleName} terminó inesperadamente (código: ${code})`);
			}
			this.removeWrapperReference(moduleName);
		});

		// Esperar inicialización del IPC
		await new Promise((resolve) => setTimeout(resolve, 1000));

		return pythonProcess;
	}

	private setupProcessLogging(process: ChildProcess, moduleName: string) {
		const logHandler = (data: Buffer) => {
			const msg = data.toString().trim();
			if (!msg) return;

			const match = msg.match(/^\[(DEBUG|INFO|OK|WARN|ERROR)\]\s+(.*)/i);
			if (match) {
				const levelStr = match[1].toUpperCase();
				const content = `[Py:${moduleName}] ${match[2]}`;

				// Mapeo seguro de strings a métodos de Logger
				switch (levelStr) {
					case "DEBUG":
						Logger.debug(content);
						break;
					case "INFO":
						Logger.info(content);
						break;
					case "OK":
						Logger.ok(content);
						break;
					case "WARN":
						Logger.warn(content);
						break;
					case "ERROR":
						Logger.error(content);
						break;
					default:
						Logger.info(content);
				}
			} else {
				Logger.info(`[Py:${moduleName}] ${msg}`);
			}
		};

		process.stdout?.on("data", logHandler);
		process.stderr?.on("data", logHandler);
	}

	// Limpieza de referencias si el proceso muere solo
	private removeWrapperReference(name: string) {
		for (const role of ["provider", "utility", "service"] as ModuleRole[]) {
			this.modules[role] = this.modules[role].filter((m) => m.name !== name);
		}
	}

	// Detiene los procesos en orden
	async stopAll(): Promise<void> {
		Logger.info("[PythonLoader] Iniciando secuencia de apagado ordenada...");

		const stopGroup = async (wrappers: PythonModuleWrapper[], groupName: string) => {
			if (wrappers.length === 0) return;
			Logger.debug(`[PythonLoader] Deteniendo ${groupName} (${wrappers.length})...`);
			await Promise.all(wrappers.map((w) => w.stop()));
			wrappers.length = 0;
		};

		await stopGroup(this.modules.provider, "Providers");
		await stopGroup(this.modules.utility, "Utilities");
		await stopGroup(this.modules.service, "Services");

		Logger.ok("[PythonLoader] Todos los procesos Python han sido detenidos.");
	}
}

export default PythonLoader;
