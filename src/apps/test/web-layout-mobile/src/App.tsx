import React, { createElement, useState, useEffect, useRef } from 'react';
import { Shell } from './components/Shell.tsx';
import { router } from '@ui-library/utils/router.js';
import { createApp } from 'vue';
import '@ui-library/loader';

// Limpieza de Service Workers en desarrollo
if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations().then(registrations => {
		for (const registration of registrations) {
			registration.unregister();
		}
	});
	caches.keys().then(names => {
		for (const name of names) caches.delete(name);
	});
}

const moduleToSafeName: Record<string, string> = {
	'home': 'home',
};

const moduleFramework: Record<string, 'react' | 'vue' | 'vanilla'> = {
	'home': 'vanilla',
};

const routeToModule: Record<string, string> = {
	'/': 'home',
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
			default:
				throw new Error(`Módulo desconocido: ${safeName}`);
		}
		
		let WrapperComponent;
		
		if (framework === 'vue') {
			WrapperComponent = (props: any) => {
				const containerRef = React.useRef<HTMLDivElement>(null);
				const vueAppRef = React.useRef<any>(null);
				
				React.useEffect(() => {
					if (containerRef.current && !vueAppRef.current) {
						vueAppRef.current = createApp(RemoteComponent, props);
						vueAppRef.current.mount(containerRef.current);
					}
					
					return () => {
						if (vueAppRef.current) {
							vueAppRef.current.unmount();
							vueAppRef.current = null;
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
			WrapperComponent = () => {
				const containerRef = React.useRef<HTMLDivElement>(null);
				const appInstanceRef = React.useRef<any>(null);
				
				React.useEffect(() => {
					if (containerRef.current && !appInstanceRef.current) {
						appInstanceRef.current = new RemoteComponent();
						appInstanceRef.current.mount(containerRef.current);
					}
					
					return () => {
						if (appInstanceRef.current && appInstanceRef.current.unmount) {
							appInstanceRef.current.unmount();
							appInstanceRef.current = null;
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
		console.error(`[Layout Mobile] ❌ Error cargando ${moduleName}:`, error);
		
		const ErrorComponent = () => {
			return React.createElement(
				'div',
				{ 
					style: { 
						padding: '20px', 
						textAlign: 'center',
						color: '#f56565'
					}
				},
				React.createElement('p', null, `Error cargando ${moduleName}`)
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
			
			const moduleName = routeToModule[path] || routeToModule['/'];
			
			loadingPathRef.current = path;
			setLoading(true);
			
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const data = await loadRemoteComponent(moduleName);
			
			setCurrentPath(path);
			setModuleData(data);
			setRenderKey(prev => prev + 1);
			setLoading(false);
			loadingPathRef.current = null;
		}

		loadComponent(window.location.pathname);
		router.setOnRouteChange((path) => {
			loadComponent(path);
		});
	}, []);

	if (!moduleData || loading) {
		return (
			<Shell currentPath={currentPath}>
				<div style={{ 
					padding: '40px 20px', 
					textAlign: 'center',
					color: '#a0aec0'
				}}>
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

