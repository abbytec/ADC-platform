import { Config } from '@stencil/core';

/**
 * Stencil config para web-ui-library-mobile
 * 
 * Generado automáticamente por UIFederationService.
 * Los componentes usan CSS puro (compatible con Shadow DOM).
 */
export const config: Config = {
    namespace: 'web-ui-library-mobile',
    cacheDir: '../../../../temp/stencil-cache/mobile/web-ui-library-mobile',
    outputTargets: [
        {
            type: 'dist',
            dir: '../../../../temp/ui-builds/mobile/web-ui-library-mobile',
        },
        {
            type: 'dist-custom-elements',
            dir: '../../../../temp/ui-builds/mobile/web-ui-library-mobile/custom-elements',
            customElementsExportBehavior: 'auto-define-custom-elements',
            externalRuntime: true,
        },
    ],
    sourceMap: true,
    buildEs5: false,
};
