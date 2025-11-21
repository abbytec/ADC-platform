import { Config } from '@stencil/core';

export const config: Config = {
	namespace: 'web-ui-library',
	outputTargets: [
		{
			type: 'dist',
			dir: 'dist-ui',
			esmLoaderPath: '../loader',
		},
		{
			type: 'dist-custom-elements',
			dir: 'dist-ui/dist-custom-elements',
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

