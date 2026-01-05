/**
 * Strategy Pattern para UIFederationService
 *
 * Cada framework tiene su propia estrategia que maneja:
 * - Generación de configuración
 * - Inicio de dev server
 * - Build estático
 * - Validación de configuración
 */

import type { IFrameworkStrategy } from "./types.js";

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
 * Obtiene la estrategia para un framework específico
 * @param framework Identificador del framework (ej: "react", "vite-react", "astro")
 * @throws Error si el framework no está soportado
 */
export function getStrategy(framework: string): IFrameworkStrategy {
	const strategy = STRATEGY_MAP[framework];

	if (!strategy) {
		const supportedFrameworks = Object.keys(STRATEGY_MAP).join(", ");
		throw new Error(`Framework "${framework}" no soportado. ` + `Opciones disponibles: ${supportedFrameworks}`);
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
