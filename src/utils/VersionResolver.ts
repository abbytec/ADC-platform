import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Logger } from "./logger/Logger.js";

export class VersionResolver {
	static readonly #isDevelopment = process.env.NODE_ENV === "development";
	static readonly #fileExtension = this.#isDevelopment ? ".ts" : ".js";

	/**
	 * Compara dos versiones semánticas (1.2.3)
	 * @returns -1 si v1 < v2, 0 si v1 === v2, 1 si v1 > v2
	 */
	static compareVersions(v1: string, v2: string): number {
		const parts1 = v1.split(".").map(Number);
		const parts2 = v2.split(".").map(Number);

		for (let i = 0; i < 3; i++) {
			const p1 = parts1[i] || 0;
			const p2 = parts2[i] || 0;
			if (p1 < p2) return -1;
			if (p1 > p2) return 1;
		}
		return 0;
	}

	/**
	 * Verifica si una versión cumple con un rango especificado
	 * @param version Versión a verificar (ej: 1.2.3)
	 * @param range Rango requerido (ej: ^1.0.0, >=1.0.0, 1.2.3, >1.0.0)
	 */
	static satisfiesRange(version: string, range: string): boolean {
		if (range === "*" || range === "latest") {
			return true;
		}

		// Exacta
		if (!range.match(/^[\^~><=]/)) {
			return this.compareVersions(version, range) === 0;
		}

		// ^ (Compatible con versión: cambios menores y patches)
		if (range.startsWith("^")) {
			const baseVersion = range.substring(1);
			const [baseMajor, baseMinor] = baseVersion.split(".");
			const [major, minor] = version.split(".");

			// Mismo major, version >= base
			if (Number(major) === Number(baseMajor)) {
				return this.compareVersions(version, baseVersion) >= 0;
			}
			return false;
		}

		// ~ (Compatible con versión: solo patches)
		if (range.startsWith("~")) {
			const baseVersion = range.substring(1);
			const [baseMajor, baseMinor] = baseVersion.split(".");
			const [major, minor] = version.split(".");

			if (Number(major) === Number(baseMajor) && Number(minor) === Number(baseMinor)) {
				return this.compareVersions(version, baseVersion) >= 0;
			}
			return false;
		}

		// >= (Mayor o igual)
		if (range.startsWith(">=")) {
			return this.compareVersions(version, range.substring(2)) >= 0;
		}

		// > (Mayor que)
		if (range.startsWith(">")) {
			return this.compareVersions(version, range.substring(1)) > 0;
		}

		// <= (Menor o igual)
		if (range.startsWith("<=")) {
			return this.compareVersions(version, range.substring(2)) <= 0;
		}

		// < (Menor que)
		if (range.startsWith("<")) {
			return this.compareVersions(version, range.substring(1)) < 0;
		}

		return false;
	}

	/**
	 * Busca y retorna la mejor versión disponible de un módulo
	 * Busca directorios con patrón: {moduleName}/{version}-{language}/
	 * o {moduleName}/index.{ext} para la versión default
	 *
	 * @param modulesDir Directorio raíz de módulos (ej: src/services)
	 * @param moduleName Nombre del módulo a buscar (ej: JsonFileCrud)
	 * @param versionRange Rango de versión requerido (default: latest)
	 * @param language Lenguaje del módulo (default: typescript)
	 */
	static async resolveModuleVersion(
		modulesDir: string,
		moduleName: string,
		versionRange: string = "latest",
		language: string = "typescript"
	): Promise<{ path: string; version: string } | null> {
		try {
			const moduleBaseDir = path.join(modulesDir, moduleName);

			// Verificar si existe el directorio del módulo
			try {
				await fs.stat(moduleBaseDir);
			} catch {
				Logger.warn(`[VersionResolver] No se encontró módulo: ${moduleName}`);
				return null;
			}

			const candidates: { path: string; version: string; lang: string }[] = [];

			// Buscar directorios con patrón {version}-{language}
			const entries = await fs.readdir(moduleBaseDir, { withFileTypes: true });

			for (const entry of entries) {
				if (!entry.isDirectory()) continue;

				// Extraer versión y lenguaje del nombre: "1.0.0-ts" o "default-py"
				const match = entry.name.match(/^(.+)-([a-z]{2,})$/);
				if (match) {
					const [, version, lang] = match;
					if (lang === language || lang === this.#normalizeLanguage(language)) {
						candidates.push({
							path: path.join(moduleBaseDir, entry.name),
							version,
							lang,
						});
					}
				}
			}

			// Si no hay versiones versionadas, buscar el default (index.ts/index.js)
			if (candidates.length === 0) {
				const indexFile = path.join(moduleBaseDir, `index${this.#fileExtension}`);
				try {
					await fs.stat(indexFile);
					return {
						path: moduleBaseDir,
						version: "1.0.0",
					};
				} catch {
					Logger.warn(`[VersionResolver] No se encontró versión compatible de ${moduleName}`);
					return null;
				}
			}

			// Filtrar por rango de versión
			let compatible = candidates.filter((c) => this.satisfiesRange(c.version, versionRange));

			if (compatible.length === 0) {
				Logger.warn(`[VersionResolver] No hay versión compatible de ${moduleName} para el rango ${versionRange}`);
				return null;
			}

			// Retornar la versión más alta compatible
			compatible.sort((a, b) => this.compareVersions(b.version, a.version));
			return { path: compatible[0].path, version: compatible[0].version };
		} catch (error) {
			Logger.error(`[VersionResolver] Error resolviendo ${moduleName}: ${error}`);
			return null;
		}
	}

	/**
	 * Normaliza abreviaturas de lenguaje
	 */
	static #normalizeLanguage(lang: string): string {
		const map: Record<string, string> = {
			ts: "ts",
			typescript: "ts",
			js: "ts",
			javascript: "ts",
			py: "py",
			python: "py",
		};
		return map[lang.toLowerCase()] || lang;
	}

	/**
	 * Verifica si una versión es válida (formato semver)
	 */
	static isValidVersion(version: string): boolean {
		if (version === "default" || version === "latest") return true;
		return /^\d+\.\d+\.\d+$/.test(version);
	}
}
