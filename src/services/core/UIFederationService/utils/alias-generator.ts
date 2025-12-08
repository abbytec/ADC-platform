import * as path from "node:path";
import type { RegisteredUIModule } from "../types.js";

/**
 * Genera aliases dinámicos para bundlers basados en los exports de la ui-library
 * y las utilidades del core según las sharedLibs del módulo.
 * Simplificado: singleton a nivel de módulo con funciones puras.
 */

// Funciones internas
function findUILibrary(modules: Map<string, RegisteredUIModule>, namespace: string): RegisteredUIModule | null {
	for (const mod of modules.values()) {
		const modNamespace = mod.namespace || "default";
		if (mod.uiConfig.framework === "stencil" && modNamespace === namespace) {
			return mod;
		}
	}
	return null;
}

function addUILibraryAliases(aliases: Record<string, string>, uiLibrary: RegisteredUIModule, uiOutputBaseDir: string): void {
	const exports = uiLibrary.uiConfig.exports || {};
	const uiModuleName = uiLibrary.uiConfig.name;
	const outputDir = path.resolve(uiOutputBaseDir, uiModuleName);

	// Exports declarados en config.json
	for (const [exportName, exportPath] of Object.entries(exports)) {
		const aliasKey = `@ui-library/${exportName}`;

		if (exportName === "loader") {
			// Loader está en el output dir
			aliases[aliasKey] = path.resolve(outputDir, exportPath);
		} else {
			// Otros exports (utils, etc.) están en el source
			aliases[aliasKey] = path.resolve(uiLibrary.appDir, exportPath);
		}
	}

	// @ui-library -> init.js (auto-ejecuta loader + registra componentes)
	aliases["@ui-library"] = path.resolve(outputDir, "init.js");

	// @ui-library/styles -> CSS base de la UI library (para Tailwind)
	aliases["@ui-library/styles"] = path.resolve(outputDir, "styles.css");
}

function usesReact(module: RegisteredUIModule): boolean {
	const framework = module.uiConfig.framework || "";
	return framework === "react" || framework === "vite-react" || (module.uiConfig.sharedLibs?.includes("react") ?? false);
}

/** Singleton de AliasGenerator */
export default {
	/** Genera aliases para un módulo específico */
	generate(
		registeredModules: Map<string, RegisteredUIModule>,
		uiOutputBaseDir: string,
		targetModule: RegisteredUIModule
	): Record<string, string> {
		const aliases: Record<string, string> = {};
		const namespace = targetModule.namespace || "default";

		const uiLibrary = findUILibrary(registeredModules, namespace);
		if (uiLibrary) {
			addUILibraryAliases(aliases, uiLibrary, uiOutputBaseDir);
		}

		if (usesReact(targetModule)) {
			aliases["@adc/utils"] = path.resolve(process.cwd(), "src/utils");
		}

		return aliases;
	},

	/** Genera aliases formateados para configuración de Rspack (escapando backslashes) */
	generateForRspack(registeredModules: Map<string, RegisteredUIModule>, uiOutputBaseDir: string, targetModule: RegisteredUIModule): string {
		const aliases = this.generate(registeredModules, uiOutputBaseDir, targetModule);

		if (Object.keys(aliases).length === 0) {
			return "{}";
		}

		const aliasEntries = Object.entries(aliases)
			.map(([key, value]) => `            '${key}': '${value.replace(/\\/g, "\\\\")}'`)
			.join(",\n");

		return `{\n${aliasEntries}\n        }`;
	},

	/** Detecta todos los frameworks usados por los módulos registrados */
	detectUsedFrameworks(registeredModules: Map<string, RegisteredUIModule>, targetModule: RegisteredUIModule): Set<string> {
		const usedFrameworks = new Set<string>();
		const framework = targetModule.uiConfig.framework || "vanilla";

		if (framework !== "vanilla") {
			const baseFramework = framework.startsWith("vite-") ? framework.replace("vite-", "") : framework;
			if (baseFramework !== "vanilla") {
				usedFrameworks.add(baseFramework);
			}
		}

		if (targetModule.uiConfig.sharedLibs) {
			targetModule.uiConfig.sharedLibs.forEach((lib) => usedFrameworks.add(lib));
		}

		const isHost = targetModule.uiConfig.name.includes("layout");
		if (isHost) {
			const namespace = targetModule.namespace || "default";
			for (const [moduleName, mod] of registeredModules.entries()) {
				const modNamespace = mod.namespace || "default";
				if (moduleName !== "layout" && mod.uiConfig.devPort && modNamespace === namespace) {
					const remoteFramework = mod.uiConfig.framework || "react";
					const baseRemoteFramework = remoteFramework.startsWith("vite-") ? remoteFramework.replace("vite-", "") : remoteFramework;
					if (baseRemoteFramework !== "vanilla") {
						usedFrameworks.add(baseRemoteFramework);
					}
				}
			}
		}

		return usedFrameworks;
	},
};
