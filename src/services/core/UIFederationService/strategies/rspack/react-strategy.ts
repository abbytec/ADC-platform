import { RspackBaseStrategy } from "./base.js";
import type { IBuildContext } from "../types.js";

/**
 * Estrategia Rspack para React con Module Federation
 */
export class ReactRspackStrategy extends RspackBaseStrategy {
	readonly name = "React (Rspack)";
	readonly framework = "react";

	protected getFileExtension(): string {
		return ".tsx";
	}

	protected getResolveExtensions(): string[] {
		return [".tsx", ".ts", ".jsx", ".js", ".json", ".css"];
	}

	protected getMainEntry(): string {
		return "./src/main.tsx";
	}

	protected getImports(): string {
		return `
import * as path from 'node:path';
import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
`;
	}

	protected getModuleRules(isProduction: boolean, postcssConfigPath: string): string {
		const developmentValue = isProduction ? "false" : "true";

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
                test: /\\.tsx?$/,
                use: {
                    loader: 'builtin:swc-loader',
                    options: {
                        jsc: {
                            parser: { syntax: 'typescript', tsx: true },
                            transform: { react: { runtime: 'automatic', development: ${developmentValue}, refresh: false } },
                        },
                    },
                },
                exclude: /node_modules/,
            },${cssRule}
    `;
	}

	protected getPlugins(context: IBuildContext, isHost: boolean, usedFrameworks: Set<string>): string {
		const hasI18n = context.module.uiConfig.i18n;
		const moduleName = context.module.uiConfig.name;

		const i18nScript = isHost && hasI18n ? this.getI18nTemplate(moduleName) : `
            template: './index.html',`;

		// Vue feature flags solo si algún remote usa Vue
		const vueFeatureFlags = usedFrameworks.has("vue") ? `
        new rspack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),` : "";

		return `${vueFeatureFlags}
        new rspack.HtmlRspackPlugin({${i18nScript}
        }),
    `;
	}
}
