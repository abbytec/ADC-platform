import React, { createElement, useState, useEffect } from 'react';
import { Shell } from './components/Shell.tsx';
import { router } from '@ui-library/utils/router.js';

// Mapeo de nombres de módulos a nombres seguros para Module Federation
const moduleToSafeName: Record<string, string> = {
	'home': 'home',
	'users-management': 'users_management',
	'config': 'config',
};

// Carga dinámica de componentes federados vía Rspack Module Federation
async function loadRemoteComponent(moduleName: string) {
	try {
		const safeName = moduleToSafeName[moduleName];
		if (!safeName) {
			throw new Error(`Módulo desconocido: ${moduleName}`);
		}
		
		console.log(`[Layout] Cargando módulo federado: ${moduleName} (como ${safeName})`);
		
		// Module Federation maneja la carga automáticamente usando nombres seguros
		let module;
		
		switch (safeName) {
			case 'home':
				module = await import('home/App' as any);
				break;
			case 'users_management':
				// IMPORTANTE: El nombre aquí debe coincidir con el configurado en remotes
				module = await import('users-management/App' as any);
				break;
			case 'config':
				module = await import('config/App' as any);
				break;
			default:
				throw new Error(`Módulo desconocido: ${safeName}`);
		}
		
		console.log(`[Layout] Módulo ${moduleName} cargado exitosamente`);
		return module.default ?? module;
	} catch (error) {
		console.error(`[Layout] Error cargando módulo federado ${moduleName}:`, error);
		// Componente de error más informativo
		return () => React.createElement('div', { 
			style: { padding: '20px', color: 'red', border: '1px solid red', borderRadius: '4px', margin: '20px 0' } 
		}, [
			React.createElement('h3', { key: 'title' }, `Error cargando módulo: ${moduleName}`),
			React.createElement('p', { key: 'msg', style: { fontSize: '14px' } }, error instanceof Error ? error.message : String(error)),
			React.createElement('p', { key: 'hint', style: { fontSize: '12px', color: '#666' } }, 'Verifica que el dev server del módulo remoto esté corriendo.')
		]);
	}
}

// Mapeo de rutas a módulos
const routeToModule: Record<string, string> = {
	'/': 'home',
	'/users': 'users-management',
	'/config': 'config',
};

export default function App() {
	const [currentComponent, setCurrentComponent] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadComponent() {
			const currentPath = window.location.pathname;
			console.log('[Layout] Ruta actual:', currentPath);
			
			const moduleName = routeToModule[currentPath];
			
			if (moduleName) {
				const Component = await loadRemoteComponent(moduleName);
				setCurrentComponent(() => Component);
			} else {
				console.warn('[Layout] Ruta no reconocida:', currentPath);
			}
			
			setLoading(false);
		}

		loadComponent();

		// Escuchar cambios de ruta para navegación SPA
		router.setOnRouteChange(async (path) => {
			console.log('[Layout] Cambio de ruta detectado:', path);
			const moduleName = routeToModule[path];
			if (moduleName) {
				setLoading(true);
				const Component = await loadRemoteComponent(moduleName);
				setCurrentComponent(() => Component);
				setLoading(false);
			}
		});
	}, []);

	return (
		<Shell>
			{loading ? (
				<div style={{ padding: '20px', textAlign: 'center' }}>
					<p>Cargando...</p>
				</div>
			) : currentComponent ? (
				createElement(currentComponent)
			) : (
				<div style={{ padding: '20px', color: '#666' }}>
					<p>Ruta no encontrada: {window.location.pathname}</p>
					<p style={{ fontSize: '14px' }}>Rutas disponibles: /, /users, /config</p>
				</div>
			)}
		</Shell>
	);
}

