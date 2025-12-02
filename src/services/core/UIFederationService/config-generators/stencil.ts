import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";

/**
 * Genera el archivo stencil.config.ts para una app
 * 
 * Los web components usan CSS puro para máxima compatibilidad con Shadow DOM.
 * Tailwind CSS se usa en las apps consumidoras (layouts, microfrontends).
 * 
 * - Todos los outputs van a temp/ui-builds/{namespace}/{name}/
 * - El cache de Stencil va a temp/stencil-cache/{namespace}/{name}/
 * - Solo el stencil.config.ts queda en la app (requerido por Stencil CLI)
 */
export async function generateStencilConfig(
	appDir: string, 
	config: UIModuleConfig, 
	uiOutputBaseDir: string,
	logger?: any
): Promise<string> {
	const namespace = config.uiNamespace || "default";
	const targetDir = path.join(uiOutputBaseDir, config.name);
	const relativeOutputDir = path.relative(appDir, targetDir).replace(/\\/g, "/");
	
	// Cache de Stencil en temp/
	const cacheDir = path.resolve(process.cwd(), "temp", "stencil-cache", namespace, config.name);
	const relativeCacheDir = path.relative(appDir, cacheDir).replace(/\\/g, "/");
	
	// Asegurar que el directorio de cache existe
	await fs.mkdir(cacheDir, { recursive: true });

	const configContent = `import { Config } from '@stencil/core';

/**
 * Stencil config para ${config.name}
 * 
 * Generado automáticamente por UIFederationService.
 * Los componentes usan CSS puro (compatible con Shadow DOM).
 */
export const config: Config = {
	namespace: '${config.name}',
	cacheDir: '${relativeCacheDir}',
	outputTargets: [
		{
			type: 'dist',
			dir: '${relativeOutputDir}',
		},
		{
			type: 'dist-custom-elements',
			dir: '${relativeOutputDir}/custom-elements',
			customElementsExportBehavior: 'auto-define-custom-elements',
			externalRuntime: false,
		},
		{
			type: 'docs-readme',
		},
	],
	sourceMap: true,
	buildEs5: false,
};
`;

	// El stencil.config.ts debe estar en la app porque Stencil lo requiere ahí
	const configPath = path.join(appDir, "stencil.config.ts");
	await fs.writeFile(configPath, configContent, "utf-8");
	
	logger?.logDebug(`Stencil config generado para ${config.name} [${namespace}]`);

	return configPath;
}
