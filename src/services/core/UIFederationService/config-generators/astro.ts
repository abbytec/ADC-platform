import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { UIModuleConfig } from "../../../../interfaces/modules/IUIModule.js";

/**
 * Genera el archivo astro.config.mjs para una app
 */
export async function generateAstroConfig(
	appDir: string,
	config: UIModuleConfig,
	options?: any
): Promise<string> {
	const outputDir = config.outputDir || "dist-ui";
	const astroDefaults = options?.astroDefaults || {
		output: "static",
		build: { format: "file" },
	};

	const sharedLibs = config.sharedLibs || [];
	const needsReact = sharedLibs.includes("react");
	const needsVue = sharedLibs.includes("vue");

	const imports: string[] = ["import { defineConfig } from 'astro/config';"];
	const integrations: string[] = [];

	if (needsReact) {
		imports.push("import react from '@astrojs/react';");
		integrations.push("react()");
	}
	if (needsVue) {
		imports.push("import vue from '@astrojs/vue';");
		integrations.push("vue()");
	}

	const finalConfig = {
		...astroDefaults,
		...(config.astroConfig || {}),
		outDir: `./${outputDir}`,
	};

	const configContentParts: string[] = [
		``,
		imports.join("\n"),
		``,
		`export default defineConfig({`,
		`  output: "${finalConfig.output}",`,
		`  outDir: "${finalConfig.outDir}",`,
	];

	const buildConfig = {
		...(finalConfig.build || {}),
		format: "directory",
	};

	configContentParts.push(`  build: ${JSON.stringify(buildConfig)},`);

	if (integrations.length > 0) {
		configContentParts.push(`  integrations: [${integrations.join(", ")}],`);
	}

	configContentParts.push(`});`);

	const configContent = configContentParts.join("\n");

	const configPath = path.join(appDir, "astro.config.mjs");
	await fs.writeFile(configPath, configContent, "utf-8");

	return configPath;
}

