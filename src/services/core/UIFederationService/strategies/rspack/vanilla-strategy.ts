import { RspackBaseStrategy } from "./base.js";
import type { IBuildContext } from "../types.js";

/**
 * Estrategia Rspack para JavaScript Vanilla con Module Federation
 */
export class VanillaRspackStrategy extends RspackBaseStrategy {
	readonly name = "Vanilla JS (Rspack)";
	readonly framework = "vanilla";

	protected getFileExtension(): string {
		return ".js";
	}

	protected getResolveExtensions(): string[] {
		return [".js", ".json", ".css"];
	}

	protected getMainEntry(): string {
		return "./src/main.js";
	}

	protected getImports(): string {
		return `
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rspack } from '@rspack/core';
const { ModuleFederationPlugin } = rspack.container;
`;
	}

	protected getModuleRules(_isProduction: boolean, postcssConfigPath: string): string {
		const cssRule = postcssConfigPath
			? `
            {
                test: /\\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                config: '${postcssConfigPath.replace(/\\/g, "/")}',
                            },
                        },
                    },
                ],
                type: 'javascript/auto',
            }`
			: `
            {
                test: /\\.css$/,
                use: ['style-loader', 'css-loader'],
                type: 'javascript/auto',
            }`;

		return `
            {
                test: /\\.js$/,
                exclude: /node_modules/,
                type: 'javascript/auto',
            },${cssRule}
    `;
	}

	protected getPlugins(context: IBuildContext, isHost: boolean, usedFrameworks: Set<string>): string {
		const hasI18n = context.module.uiConfig.i18n;

		const i18nScript =
			isHost && hasI18n
				? this.getI18nTemplate(context)
				: `
            template: './index.html',`;

		// Vue/React feature flags si los remotes los usan
		let featureFlags = "";

		if (usedFrameworks.has("vue")) {
			featureFlags += `
        new rspack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),`;
		}

		// Solo hosts necesitan HtmlRspackPlugin (remotes solo exponen assets)
		const htmlPlugin = isHost
			? `
        new rspack.HtmlRspackPlugin({${i18nScript}
        }),`
			: "";

		return `${featureFlags}${htmlPlugin}
    `;
	}
}
