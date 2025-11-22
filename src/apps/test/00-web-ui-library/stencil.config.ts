import { Config } from '@stencil/core';

export const config: Config = {
  "namespace": "web-ui-library",
  "outputTargets": [
    {
      "type": "dist",
      "dir": "../../../../temp/ui-builds/web-ui-library"
    },
    {
      "type": "dist-custom-elements",
      "dir": "../../../../temp/ui-builds/web-ui-library/custom-elements",
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
