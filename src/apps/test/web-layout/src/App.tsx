import { createElement, useState, useEffect, useRef } from 'react';
import { Shell } from './components/Shell.tsx';
import { router } from '@ui-library/utils/router';
import { loadRemoteComponent, type Framework } from '@adc/utils/react/loadRemoteComponent';
import '@ui-library/loader';

// Las funciones t(), setLocale(), getLocale() están disponibles globalmente
// desde adc-i18n.js (cargado en index.html)

interface ModuleDefinition {
	framework: Framework;
	importFn: () => Promise<any>;
}

const moduleDefinitions: Record<string, ModuleDefinition> = {
	'home': {
		framework: 'vanilla',
		importFn: () => import('home/App' as any),
	},
	'users-management': {
		framework: 'react',
		importFn: () => import('users-management/App' as any),
	},
	'config': {
		framework: 'vue',
		importFn: () => import('config/App' as any),
	},
};

const routeToModule: Record<string, string> = {
	'/': 'home',
	'/users': 'users-management',
	'/config': 'config',
};

export default function App() {
	const [renderKey, setRenderKey] = useState(0);
	const [currentPath, setCurrentPath] = useState(window.location.pathname);
	const [moduleData, setModuleData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const loadingPathRef = useRef<string | null>(null);
	const isInitialized = useRef(false);

	useEffect(() => {
		if (isInitialized.current) return;
		isInitialized.current = true;

		async function loadComponent(path: string) {
			if (loadingPathRef.current === path) return;
			
			const moduleName = routeToModule[path];
			
			// Manejo de ruta no encontrada
			if (!moduleName || !moduleDefinitions[moduleName]) {
				console.warn('[Layout] Ruta no reconocida:', path);
				setModuleData({
					Component: () => <div style={{padding: 20}}>Página no encontrada: {path}</div>,
					moduleName: 'not-found',
					timestamp: Date.now()
				});
				setLoading(false);
				return;
			}

			loadingPathRef.current = path;
			setLoading(true);
			
			// Pequeño delay para dar feedback visual y permitir a React desmontar
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const definition = moduleDefinitions[moduleName];
			const data = await loadRemoteComponent({
				importFn: definition.importFn,
				moduleName,
				framework: definition.framework,
			});
			
			console.log(`[Layout] ✅ ${data.moduleName} @ ${path}`);
			
			setCurrentPath(path);
			setModuleData(data);
			setRenderKey(prev => prev + 1);
			setLoading(false);
			loadingPathRef.current = null;
		}

		loadComponent(window.location.pathname);
		router.setOnRouteChange((path: string) => {
			console.log('[Layout] 🔄 Route change:', path);
			loadComponent(path);
		});
	}, []);

	if (!moduleData || loading) {
		return (
			<Shell currentPath={currentPath}>
				<div style={{ padding: '20px', textAlign: 'center' }}>
					<p>Cargando...</p>
				</div>
			</Shell>
		);
	}

	return (
		<Shell key={renderKey} currentPath={currentPath}>
			{createElement(moduleData.Component)}
		</Shell>
	);
}
