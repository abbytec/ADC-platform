import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Logger } from "../logger/Logger.ts";
import { ILogger } from "../../interfaces/utils/ILogger.js";

/**
 * Gestiona las operaciones de Docker Compose para apps y servicios del Kernel.
 */
export class DockerManager {
	readonly #logger: ILogger = Logger.getLogger("DockerManager");
	readonly #appDockerComposeMap = new Map<string, string>();
	readonly #serviceDockerComposeMap = new Map<string, string>();

	/**
	 * Ejecuta docker-compose up -d en el directorio especificado.
	 */
	async runDockerCompose(dir: string, name: string, type: "app" | "service"): Promise<void> {
		const dockerComposeFile = path.join(dir, "docker-compose.yml");
		await fs.stat(dockerComposeFile);

		this.#logger.logInfo(`Iniciando servicios Docker para ${name}...`);

		const { spawn } = await import("node:child_process");
		const docker = spawn("docker", ["compose", "-f", dockerComposeFile, "up", "-d"], {
			cwd: dir,
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
					this.#logger.logOk(`Servicios Docker iniciados para ${name}`);
					const map = type === "app" ? this.#appDockerComposeMap : this.#serviceDockerComposeMap;
					map.set(name, dir);
					setTimeout(() => resolve(), 3000);
				} else {
					this.#logger.logWarn(`docker-compose falló con código ${code}`);
					reject(new Error(`docker-compose exit code: ${code}`));
				}
			});
		});
	}

	/**
	 * Inicia docker-compose para una app específica.
	 */
	async startDockerCompose(appDir: string, appName: string): Promise<void> {
		try {
			await this.runDockerCompose(appDir, appName, "app");
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				this.#logger.logWarn(`No se pudo ejecutar docker-compose: ${error.message}`);
			}
		}
	}

	/**
	 * Inicia docker-compose para un servicio kernel específico.
	 */
	async startServiceDockerCompose(serviceDir: string, serviceName: string): Promise<void> {
		try {
			await this.runDockerCompose(serviceDir, serviceName, "service");
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				this.#logger.logDebug(`docker-compose no disponible para ${serviceName}`);
			}
		}
	}

	/**
	 * Detiene docker-compose en el directorio especificado.
	 */
	async stopDockerCompose(appDir: string): Promise<void> {
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
		}
	}

	/**
	 * Verifica si una app tiene docker-compose configurado.
	 */
	hasAppDockerCompose(appBaseName: string): boolean {
		return this.#appDockerComposeMap.has(appBaseName);
	}

	/**
	 * Obtiene el directorio de docker-compose de una app.
	 */
	getAppDockerComposeDir(appBaseName: string): string | undefined {
		return this.#appDockerComposeMap.get(appBaseName);
	}

	/**
	 * Elimina el registro de docker-compose de una app.
	 */
	deleteAppDockerCompose(appBaseName: string): void {
		this.#appDockerComposeMap.delete(appBaseName);
	}

	/**
	 * Verifica si un servicio tiene docker-compose configurado.
	 */
	hasServiceDockerCompose(serviceName: string): boolean {
		return this.#serviceDockerComposeMap.has(serviceName);
	}

	/**
	 * Obtiene el directorio de docker-compose de un servicio.
	 */
	getServiceDockerComposeDir(serviceName: string): string | undefined {
		return this.#serviceDockerComposeMap.get(serviceName);
	}

	/**
	 * Elimina el registro de docker-compose de un servicio.
	 */
	deleteServiceDockerCompose(serviceName: string): void {
		this.#serviceDockerComposeMap.delete(serviceName);
	}
}
