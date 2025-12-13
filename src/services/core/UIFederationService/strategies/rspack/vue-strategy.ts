import { RspackBaseStrategy } from "./base.js";
import type { IBuildContext } from "../types.js";

/**
 * Estrategia Rspack para Vue con Module Federation
 */
export class VueRspackStrategy extends RspackBaseStrategy {
	readonly name = "Vue (Rspack)";
	readonly framework = "vue";

	protected getFileExtension(): string {
		return ".vue";
	}

	protected getResolveExtensions(): string[] {
		return [".vue", ".tsx", ".ts", ".jsx", ".js", ".json", ".css"];
	}

	protected getMainEntry(): string {
		return "./src/main.ts";
	}

	protected getImports(): string {
		return `
import * as path from 'node:path';
import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { VueLoaderPlugin } from 'vue-loader';
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
            },${cssRule},
            {
                test: /\\.vue$/,
                loader: 'vue-loader',
                options: {
                    compilerOptions: {
                        // Reconocer web components con prefijo "adc-"
                        isCustomElement: (tag) => tag.startsWith('adc-'),
                    },
                },
                exclude: /node_modules/,
            },
            {
                test: /\\.css$/,
                use: ['style-loader', 'css-loader'],
            }
    `;
	}

	protected getPlugins(context: IBuildContext, isHost: boolean, _usedFrameworks: Set<string>): string {
		const hasI18n = context.module.uiConfig.i18n;
		const moduleName = context.module.uiConfig.name;

		const i18nScript = isHost && hasI18n ? this.getI18nTemplate(moduleName) : `
            template: './index.html',`;

		// Solo hosts necesitan HtmlRspackPlugin (remotes solo exponen assets)
		const htmlPlugin = isHost
			? `
        new rspack.HtmlRspackPlugin({${i18nScript}
        }),`
			: "";

		// Vue feature flags siempre necesarios para Vue
		return `
        new rspack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),${htmlPlugin}
        new VueLoaderPlugin(),
    `;
	}
}
