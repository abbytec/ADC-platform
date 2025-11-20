import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	plugins: [react()],
	build: {
		outDir: 'dist-ui',
		emptyOutDir: true,
		watch: process.env.NODE_ENV === 'development' ? {} : null,
		lib: {
			entry: {
				'App': path.resolve(__dirname, 'src/App.tsx'),
				'components/Container': path.resolve(__dirname, 'src/components/Container.tsx'),
				'components/Header': path.resolve(__dirname, 'src/components/Header.tsx'),
				'components/PrimaryButton': path.resolve(__dirname, 'src/components/PrimaryButton.tsx'),
				'components/StatCard': path.resolve(__dirname, 'src/components/StatCard.tsx'),
				'utils/router': path.resolve(__dirname, 'src/utils/router.ts'),
			},
			formats: ['es'],
			fileName: (format, entryName) => `${entryName}.js`
		},
		rollupOptions: {
			external: [
				'react',
				'react-dom',
				'react-dom/client',
				'react/jsx-runtime',
				'react/jsx-dev-runtime',
			],
			output: {
				preserveModules: false,
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM',
				}
			}
		}
	}
});

