import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";

/**
 * Genera el archivo stencil.config.ts para una app
 */
export async function generateStencilConfig(appDir: string, config: UIModuleConfig, uiOutputBaseDir: string): Promise<string> {
	const targetDir = path.join(uiOutputBaseDir, config.name);
	const relativeOutputDir = path.relative(appDir, targetDir);

	const stencilConfig: any = {
		namespace: config.name,
		outputTargets: [
			{
				type: "dist",
				dir: relativeOutputDir,
			},
			{
				type: "dist-custom-elements",
				dir: `${relativeOutputDir}/custom-elements`,
				customElementsExportBehavior: "auto-define-custom-elements",
				externalRuntime: false,
			},
			{
				type: "docs-readme",
			},
		],
		sourceMap: true,
		buildEs5: false,
	};

	const configContent = `import { Config } from '@stencil/core';\n\nexport const config: Config = ${JSON.stringify(
		stencilConfig,
		null,
		2
	)};\n`;

	const configPath = path.join(appDir, "stencil.config.ts");
	await fs.writeFile(configPath, configContent, "utf-8");

	return configPath;
}
