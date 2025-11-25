import { Config } from '@stencil/core';

export const config: Config = {
  "namespace": "web-ui-library-mobile",
  "outputTargets": [
    {
      "type": "dist",
      "dir": "../../../../temp/ui-builds/mobile/web-ui-library-mobile"
    },
    {
      "type": "dist-custom-elements",
      "dir": "../../../../temp/ui-builds/mobile/web-ui-library-mobile/custom-elements",
      "customElementsExportBehavior": "auto-define-custom-elements",
      "externalRuntime": false
    },
    {
      "type": "docs-readme"
    }
  ],
  "sourceMap": true,
  "buildEs5": false
};
