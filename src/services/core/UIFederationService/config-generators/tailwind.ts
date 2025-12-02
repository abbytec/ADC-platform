import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RegisteredUIModule } from "../types.js";

/**
 * Configuración de Tailwind para módulos UI
 * Este generador crea configuraciones de Tailwind optimizadas por módulo,
 * incluyendo solo las clases CSS utilizadas en cada microfrontend.
 */

export interface TailwindConfig {
	/** Paths de contenido para purge/scan */
	content: string[];
	/** Tema personalizado */
	theme?: Record<string, any>;
	/** Plugins de Tailwind */
	plugins?: string[];
	/** Prefijo para clases (evita colisiones) */
	prefix?: string;
}

/**
 * Genera la configuración base de Tailwind compartida
 * Esta es la configuración común que todos los módulos heredan
 */
export function getBaseTailwindConfig(): TailwindConfig {
	return {
		content: [],
		theme: {
			extend: {
				colors: {
					// Colores corporativos ADC Platform
					"adc-primary": {
						50: "#eff6ff",
						100: "#dbeafe",
						200: "#bfdbfe",
						300: "#93c5fd",
						400: "#60a5fa",
						500: "#0066cc",
						600: "#0052a3",
						700: "#003d7a",
						800: "#002952",
						900: "#001429",
					},
					"adc-success": {
						50: "#ecfdf5",
						100: "#d1fae5",
						200: "#a7f3d0",
						300: "#6ee7b7",
						400: "#34d399",
						500: "#10b981",
						600: "#059669",
						700: "#047857",
						800: "#065f46",
						900: "#064e3b",
					},
					"adc-warning": {
						50: "#fffbeb",
						100: "#fef3c7",
						200: "#fde68a",
						300: "#fcd34d",
						400: "#fbbf24",
						500: "#f59e0b",
						600: "#d97706",
						700: "#b45309",
						800: "#92400e",
						900: "#78350f",
					},
					"adc-danger": {
						50: "#fef2f2",
						100: "#fee2e2",
						200: "#fecaca",
						300: "#fca5a5",
						400: "#f87171",
						500: "#ef4444",
						600: "#dc2626",
						700: "#b91c1c",
						800: "#991b1b",
						900: "#7f1d1d",
					},
				},
				fontFamily: {
					sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
				},
				spacing: {
					"adc-sm": "0.5rem",
					"adc-md": "1rem",
					"adc-lg": "1.5rem",
					"adc-xl": "2rem",
				},
				borderRadius: {
					"adc": "0.375rem",
				},
			},
		},
		plugins: [],
	};
}

/**
 * Genera la configuración de Tailwind para un módulo específico
 * Incluye solo los paths de contenido relevantes para optimizar el CSS final
 */
export async function generateTailwindConfig(
	module: RegisteredUIModule,
	registeredModules: Map<string, RegisteredUIModule>,
	configDir: string,
	logger?: any
): Promise<string> {
	const baseConfig = getBaseTailwindConfig();
	const contentPaths: string[] = [];
	const namespace = module.namespace || "default";
	const framework = module.uiConfig.framework || "react";

	// Agregar paths del módulo actual
	const moduleExtensions = getExtensionsForFramework(framework);
	contentPaths.push(
		`${module.appDir}/src/**/*.{${moduleExtensions}}`,
		`${module.appDir}/index.html`
	);

	// Si es un host (layout), incluir paths de componentes compartidos
	const isHost = module.uiConfig.name.includes("layout");
	if (isHost) {
		// Incluir la ui-library del namespace para que Tailwind detecte clases usadas
		for (const mod of registeredModules.values()) {
			if (mod.uiConfig.framework === "stencil" && mod.namespace === namespace) {
				contentPaths.push(`${mod.appDir}/src/**/*.{tsx,ts,jsx,js}`);
			}
		}
	}

	// Buscar ui-library del namespace para incluir sus utilidades de Tailwind
	let uiLibraryModule: RegisteredUIModule | null = null;
	for (const mod of registeredModules.values()) {
		if (mod.uiConfig.framework === "stencil" && mod.namespace === namespace) {
			uiLibraryModule = mod;
			break;
		}
	}

	const tailwindConfig = {
		...baseConfig,
		content: contentPaths,
	};

	// Si la ui-library tiene exports de utilidades Tailwind, incluirlas en el tema
	if (uiLibraryModule) {
		const utilsPath = path.join(uiLibraryModule.appDir, "utils", "tailwind-preset.js");
		try {
			await fs.access(utilsPath);
			// Si existe un preset personalizado, lo referenciamos
			tailwindConfig.plugins = [`require('${utilsPath.replace(/\\/g, "/")}')`];
		} catch {
			// No hay preset personalizado, continuar sin él
		}
	}

	// Crear el archivo tailwind.config.js
	await fs.mkdir(configDir, { recursive: true });
	
	const configContent = `/** @type {import('tailwindcss').Config} */
export default ${JSON.stringify(tailwindConfig, null, 2).replace(/"require\('([^']+)'\)"/g, "require('$1')")};
`;

	const configPath = path.join(configDir, "tailwind.config.js");
	await fs.writeFile(configPath, configContent, "utf-8");
	logger?.logDebug(`Tailwind config generado para ${module.uiConfig.name} [${namespace}] en ${configPath}`);

	return configPath;
}

/**
 * Genera el archivo postcss.config.js necesario para procesar Tailwind
 * Usa @tailwindcss/postcss (Tailwind CSS v4+)
 */
export async function generatePostCSSConfig(
	tailwindConfigPath: string,
	configDir: string,
	logger?: any
): Promise<string> {
	// Tailwind CSS v4+ requiere @tailwindcss/postcss
	const configContent = `import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
	plugins: [
		tailwindcss({ config: '${tailwindConfigPath.replace(/\\/g, "/")}' }),
		autoprefixer(),
	],
};
`;

	const configPath = path.join(configDir, "postcss.config.mjs");
	await fs.writeFile(configPath, configContent, "utf-8");
	logger?.logDebug(`PostCSS config generado en ${configPath}`);

	return configPath;
}

/**
 * Obtiene las extensiones de archivo relevantes según el framework
 */
function getExtensionsForFramework(framework: string): string {
	switch (framework) {
		case "react":
			return "tsx,ts,jsx,js,html";
		case "vue":
			return "vue,tsx,ts,jsx,js,html";
		case "vanilla":
			return "js,html,css";
		case "stencil":
			return "tsx,ts,jsx,js,css";
		default:
			return "tsx,ts,jsx,js,html,vue";
	}
}

/**
 * Verifica si un módulo tiene Tailwind habilitado en sus sharedLibs
 */
export function hasTailwindEnabled(module: RegisteredUIModule): boolean {
	const sharedLibs = module.uiConfig.sharedLibs || [];
	return sharedLibs.includes("tailwind") || sharedLibs.includes("tailwindcss");
}

