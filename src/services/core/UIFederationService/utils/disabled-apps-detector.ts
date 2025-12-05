import * as fs from "node:fs/promises";
import * as path from "node:path";
import { outputBasePath } from "./path-resolver.js";

const getAppsDir = () => path.resolve(outputBasePath, "apps", "test");
/**
 * Detecta apps deshabilitadas en el directorio de apps.
 * Extraído de la lógica duplicada en rspack.ts y vite.ts.
 */
export class DisabledAppsDetector {
	/**
	 * Obtiene el conjunto de apps deshabilitadas
	 */
	async getDisabledApps(): Promise<Set<string>> {
		const appsDir = getAppsDir();
		const disabledApps = new Set<string>();

		try {
			const entries = await fs.readdir(appsDir, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) {
					const isDisabled = await this.isAppDisabled(path.join(appsDir, entry.name));
					if (isDisabled) {
						disabledApps.add(entry.name);
					}
				}
			}
		} catch {
			// Si no se puede leer el directorio, retornar set vacío
		}

		return disabledApps;
	}

	/**
	 * Verifica si una app está deshabilitada
	 */
	private async isAppDisabled(appDir: string): Promise<boolean> {
		// Verificar default.json
		try {
			const defaultConfigPath = path.join(appDir, "default.json");
			const content = await fs.readFile(defaultConfigPath, "utf-8");
			const config = JSON.parse(content);
			if (config.disabled === true) {
				return true;
			}
		} catch {
			// No hay default.json, continuar
		}

		// Verificar config.json
		try {
			const configPath = path.join(appDir, "config.json");
			const content = await fs.readFile(configPath, "utf-8");
			const config = JSON.parse(content);
			if (config.disabled === true || (config.uiModule && config.uiModule.disabled === true)) {
				return true;
			}
		} catch {
			// No hay config.json, continuar
		}

		return false;
	}

	/**
	 * Obtiene los externals para apps deshabilitadas (para bundlers)
	 */
	async getExternalsForDisabledApps(logger?: any): Promise<string[]> {
		const disabledApps = await this.getDisabledApps();
		const externals: string[] = [];
		const appsDir = getAppsDir();

		for (const appName of disabledApps) {
			// Intentar leer el nombre del módulo desde config.json
			try {
				const appConfigPath = path.join(appsDir, appName, "config.json");
				const configContent = await fs.readFile(appConfigPath, "utf-8");
				const config = JSON.parse(configContent);
				const moduleName = config.uiModule?.name || appName;
				externals.push(`${moduleName}/App`);
				logger?.logDebug(`App deshabilitada agregada a externals: ${moduleName}`);
			} catch {
				// Si no se puede leer el config, asumir que el nombre del módulo es el nombre de la carpeta
				externals.push(`${appName}/App`);
			}
		}

		return externals;
	}

	/**
	 * Obtiene información detallada de apps deshabilitadas
	 */
	async getDisabledAppsInfo(): Promise<Array<{ name: string; moduleName: string; reason?: string }>> {
		const disabledApps = await this.getDisabledApps();
		const appsDir = getAppsDir();
		const result: Array<{ name: string; moduleName: string; reason?: string }> = [];

		for (const appName of disabledApps) {
			let moduleName = appName;
			let reason: string | undefined;

			try {
				const appConfigPath = path.join(appsDir, appName, "config.json");
				const configContent = await fs.readFile(appConfigPath, "utf-8");
				const config = JSON.parse(configContent);
				moduleName = config.uiModule?.name || appName;
				reason = config.disabledReason || config.uiModule?.disabledReason;
			} catch {
				// Usar valores por defecto
			}

			result.push({ name: appName, moduleName, reason });
		}

		return result;
	}
}

// Singleton para uso global
let detectorInstance: DisabledAppsDetector | null = null;

export function getDisabledAppsDetector(): DisabledAppsDetector {
	if (!detectorInstance) {
		detectorInstance = new DisabledAppsDetector();
	}
	return detectorInstance;
}
