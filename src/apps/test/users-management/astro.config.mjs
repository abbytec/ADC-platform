// Auto-generado por UIFederationService
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: "static",
  outDir: "./dist-ui",
  build: {"format":"directory"},
  integrations: [react()],
});