import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-discovery de componentes
function discoverComponents() {
  const componentsDir = path.resolve(__dirname, 'src/components');
  const entries: Record<string, string> = {};
  
  if (fs.existsSync(componentsDir)) {
    const files = fs.readdirSync(componentsDir);
    
    for (const file of files) {
      const ext = path.extname(file);
      if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
        const componentName = path.basename(file, ext);
        entries[`components/${componentName}`] = path.resolve(componentsDir, file);
      }
    }
  }
  
  console.log(`🔍 Componentes descubiertos: ${Object.keys(entries).length}`);
  Object.keys(entries).forEach(key => console.log(`   - ${key}`));
  
  return entries;
}

export default defineConfig({
  plugins: [react()],
  base: '/ui/ui-library/',
  define: {
    // Definir process.env para evitar errores en el browser
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist-ui',
    lib: {
      entry: discoverComponents(),
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        // Mantener las importaciones de React sin bundling
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        // Preservar la estructura de módulos
        preserveModules: false,
        // No hashear los nombres de archivo
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});

