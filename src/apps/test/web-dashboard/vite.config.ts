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
  
  console.log(`🔍 Componentes descubiertos en dashboard: ${Object.keys(entries).length}`);
  Object.keys(entries).forEach(key => console.log(`   - ${key}`));
  
  return entries;
}

export default defineConfig({
  plugins: [react()],
  base: '/ui/dashboard/',
  define: {
    // Definir process.env para evitar errores en el browser
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist-ui',
    // Usar rollupOptions sin lib mode para mejor control
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ...discoverComponents(),
      },
      // Marcar como external todos los imports federados
      external: (id) => {
        return (
          id.startsWith('react') ||
          id.startsWith('react-dom') ||
          id.startsWith('@ui-library/') ||
          id.startsWith('@dashboard/')
        );
      },
      output: {
        dir: 'dist-ui',
        format: 'es',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
