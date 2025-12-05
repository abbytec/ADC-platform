/**
 * Strategy Pattern para UIFederationService
 *
 * Cada framework tiene su propia estrategia que maneja:
 * - Generación de configuración
 * - Inicio de dev server
 * - Build estático
 * - Validación de configuración
 */

import type { IFrameworkStrategy, FrameworkInfo } from "./types.js";

// Rspack strategies (default para react, vue, vanilla)
import { ReactRspackStrategy, VueRspackStrategy, VanillaRspackStrategy } from "./rspack/index.js";

// Vite strategies (opt-in con prefijo vite-)
import { ReactViteStrategy, VueViteStrategy, VanillaViteStrategy } from "./vite/index.js";

// Standalone strategies (CLI-based)
import { AstroStrategy, StencilStrategy } from "./standalone/index.js";

/**
 * Mapa de estrategias por identificador de framework
 */
const STRATEGY_MAP: Record<string, IFrameworkStrategy> = {
	// Rspack strategies (default)
	react: new ReactRspackStrategy(),
	vue: new VueRspackStrategy(),
	vanilla: new VanillaRspackStrategy(),

	// Vite strategies (opt-in)
	"vite-react": new ReactViteStrategy(),
	"vite-vue": new VueViteStrategy(),
	vite: new VanillaViteStrategy(),
	"vite-vanilla": new VanillaViteStrategy(),

	// Standalone strategies (CLI-based)
	astro: new AstroStrategy(),
	stencil: new StencilStrategy(),
};

/**
 * Información de frameworks soportados
 */
const FRAMEWORK_INFO: FrameworkInfo[] = [
	{ id: "react", displayName: "React (Rspack)", bundler: "rspack", baseFramework: "react", requiresDevPort: true },
	{ id: "vue", displayName: "Vue (Rspack)", bundler: "rspack", baseFramework: "vue", requiresDevPort: true },
	{ id: "vanilla", displayName: "Vanilla JS (Rspack)", bundler: "rspack", baseFramework: "vanilla", requiresDevPort: true },
	{ id: "vite-react", displayName: "React (Vite)", bundler: "vite", baseFramework: "react", requiresDevPort: true },
	{ id: "vite-vue", displayName: "Vue (Vite)", bundler: "vite", baseFramework: "vue", requiresDevPort: true },
	{ id: "vite", displayName: "Vanilla JS (Vite)", bundler: "vite", baseFramework: "vanilla", requiresDevPort: false },
	{ id: "vite-vanilla", displayName: "Vanilla JS (Vite)", bundler: "vite", baseFramework: "vanilla", requiresDevPort: false },
	{ id: "astro", displayName: "Astro", bundler: "cli", baseFramework: "astro", requiresDevPort: false },
	{ id: "stencil", displayName: "Stencil", bundler: "cli", baseFramework: "stencil", requiresDevPort: false },
];

/**
 * Obtiene la estrategia para un framework específico
 * @param framework Identificador del framework (ej: "react", "vite-react", "astro")
 * @throws Error si el framework no está soportado
 */
export function getStrategy(framework: string): IFrameworkStrategy {
	const strategy = STRATEGY_MAP[framework];

	if (!strategy) {
		const supportedFrameworks = Object.keys(STRATEGY_MAP).join(", ");
		throw new Error(
			`Framework "${framework}" no soportado. ` +
			`Opciones disponibles: ${supportedFrameworks}`
		);
	}

	return strategy;
}

/**
 * Verifica si un framework está soportado
 */
export function isFrameworkSupported(framework: string): boolean {
	return framework in STRATEGY_MAP;
}

/**
 * Obtiene la lista de frameworks soportados
 */
export function getSupportedFrameworks(): string[] {
	return Object.keys(STRATEGY_MAP);
}

/**
 * Obtiene información detallada de todos los frameworks
 */
export function getFrameworksInfo(): FrameworkInfo[] {
	return [...FRAMEWORK_INFO];
}

/**
 * Obtiene información de un framework específico
 */
export function getFrameworkInfo(framework: string): FrameworkInfo | null {
	return FRAMEWORK_INFO.find((f) => f.id === framework) || null;
}

/**
 * Parsea un framework string para obtener framework base y bundler
 */
export function parseFramework(framework: string): { baseFramework: string; bundler: "rspack" | "vite" | "cli" } {
	if (framework.startsWith("vite-")) {
		return {
			baseFramework: framework.replace("vite-", ""),
			bundler: "vite",
		};
	}

	if (framework === "vite") {
		return {
			baseFramework: "vanilla",
			bundler: "vite",
		};
	}

	if (["react", "vue", "vanilla"].includes(framework)) {
		return {
			baseFramework: framework,
			bundler: "rspack",
		};
	}

	// astro, stencil -> cli
	return {
		baseFramework: framework,
		bundler: "cli",
	};
}

// Re-exports
export type { IFrameworkStrategy, IBuildContext, IBuildResult, BundlerType, FrameworkInfo } from "./types.js";
export { BaseFrameworkStrategy, BaseRspackStrategy, BaseViteStrategy, BaseCLIStrategy } from "./base-strategy.js";
