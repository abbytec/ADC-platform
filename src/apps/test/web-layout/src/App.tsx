import React, { createElement, useState, useEffect, useRef } from 'react';
import { Shell } from './components/Shell.tsx';
import { router } from '@ui-library/utils/router.js';
import { createApp } from 'vue';
import '@ui-library/loader';

// Las funciones t(), setLocale(), getLocale() están disponibles globalmente
// desde adc-i18n.js (cargado en index.html)

const moduleToSafeName: Record<string, string> = {
	'home': 'home',
	'users-management': 'users_management',
	'config': 'config',
};

const moduleFramework: Record<string, 'react' | 'vue' | 'vanilla'> = {
	'home': 'vanilla',
	'users-management': 'react',
	'config': 'vue',
};

const routeToModule: Record<string, string> = {
	'/': 'home',
	'/users': 'users-management',
	'/config': 'config',
};

async function loadRemoteComponent(moduleName: string) {
	try {
		const safeName = moduleToSafeName[moduleName];
		const framework = moduleFramework[moduleName];
		
		if (!safeName) {
			throw new Error(`Módulo desconocido: ${moduleName}`);
		}
		
		const timestamp = Date.now();
		let RemoteComponent;
		
		switch (safeName) {
			case 'home': {
				const homeModule = await import('home/App' as any);
				RemoteComponent = homeModule.default ?? homeModule;
				break;
			}
			case 'users_management': {
				const usersModule = await import('users-management/App' as any);
				RemoteComponent = usersModule.default ?? usersModule;
				break;
			}
			case 'config': {
				const configModule = await import('config/App' as any);
				RemoteComponent = configModule.default ?? configModule;
				break;
			}
			default:
				throw new Error(`Módulo desconocido: ${safeName}`);
		}
		
		console.log('[Layout] Framework detectado para', moduleName, ':', framework);
		
		if (!framework) {
			throw new Error(`Framework no definido para el módulo: ${moduleName}`);
		}
		
		let WrapperComponent;
		
		// Para componentes Vue, crear un wrapper que monte la instancia Vue
		if (framework === 'vue') {
			WrapperComponent = (props: any) => {
				const containerRef = React.useRef<HTMLDivElement>(null);
				const vueAppRef = React.useRef<any>(null);
				
				React.useEffect(() => {
					if (containerRef.current && !vueAppRef.current) {
						// Montar la app Vue
						vueAppRef.current = createApp(RemoteComponent, props);
						vueAppRef.current.mount(containerRef.current);
						console.log(`[Layout] Vue app montada: ${moduleName}`);
					}
					
					return () => {
						// Desmontar la app Vue cuando el componente React se desmonte
						if (vueAppRef.current) {
							vueAppRef.current.unmount();
							vueAppRef.current = null;
							console.log(`[Layout] Vue app desmontada: ${moduleName}`);
						}
					};
				}, []);
				
				return React.createElement(
					'div',
					{ 
						'data-module': moduleName,
						'data-framework': 'vue',
						'data-timestamp': timestamp,
						style: { display: 'contents' }
					},
					React.createElement('div', { ref: containerRef })
				);
			};
		} else if (framework === 'vanilla') {
			// Para componentes Vanilla JS, crear un wrapper que llame mount/unmount
			WrapperComponent = () => {
				const containerRef = React.useRef<HTMLDivElement>(null);
				const appInstanceRef = React.useRef<any>(null);
				
				React.useEffect(() => {
					if (containerRef.current && !appInstanceRef.current) {
						// Crear instancia de la clase y montar
						appInstanceRef.current = new RemoteComponent();
						appInstanceRef.current.mount(containerRef.current);
						console.log(`[Layout] Vanilla JS app montada: ${moduleName}`);
					}
					
					return () => {
						// Desmontar la app Vanilla JS cuando el componente React se desmonte
						if (appInstanceRef.current && appInstanceRef.current.unmount) {
							appInstanceRef.current.unmount();
							appInstanceRef.current = null;
							console.log(`[Layout] Vanilla JS app desmontada: ${moduleName}`);
						}
					};
				}, []);
				
				return React.createElement(
					'div',
					{ 
						'data-module': moduleName,
						'data-framework': 'vanilla',
						'data-timestamp': timestamp,
						style: { display: 'contents' }
					},
					React.createElement('div', { ref: containerRef })
				);
			};
		} else {
			// Para componentes React, usar el wrapper normal
			WrapperComponent = (props: any) => {
				return React.createElement(
					'div',
					{ 
						'data-module': moduleName,
						'data-framework': 'react',
						'data-timestamp': timestamp,
						style: { display: 'contents' }
					},
					React.createElement(RemoteComponent, props)
				);
			};
		}
		
		return { Component: WrapperComponent, moduleName, timestamp };
	} catch (error) {
		console.error(`[Layout] ❌ Error cargando ${moduleName}:`, error);
		
		// Determinar el código de error HTTP si es un error de red
		let httpError: number | undefined;
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CONNECTION_REFUSED')) {
			httpError = 503; // Service Unavailable
		} else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
			httpError = 404;
		}
		
		// Componente de error como React component (no necesita wrapper)
		const ErrorComponent = () => {
			return React.createElement(
				'div',
				{ 
					'data-module': moduleName,
					'data-framework': 'error',
					'data-timestamp': Date.now(),
					style: { display: 'contents' }
				},
				React.createElement('adc-error', { 
					'http-error': httpError,
					'error-title': httpError ? undefined : `Aplicación no disponible`,
					'error-description': httpError ? undefined : `En estos momentos, ${moduleName} no está disponible`,
					color: '#ef4444'
				})
			);
		};
		
		return { Component: ErrorComponent, moduleName, timestamp: Date.now() };
	}
}

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
			if (!moduleName) {
				console.warn('[Layout] Ruta no reconocida:', path);
				// Opcional: redirigir a home o mostrar 404
				if (path !== '/') {
					// router.navigate('/'); // Evitar bucles infinitos
				}
				// Permitir renderizar Shell vacía o con error
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
			
			const data = await loadRemoteComponent(moduleName);
			console.log(`[Layout] ✅ ${data.moduleName} @ ${path}`);
			
			setCurrentPath(path);
			setModuleData(data);
			setRenderKey(prev => prev + 1);
			setLoading(false);
			loadingPathRef.current = null;
		}

		loadComponent(window.location.pathname);
		router.setOnRouteChange((path) => {
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

