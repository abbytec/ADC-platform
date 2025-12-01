/**
 * Utilidad para cargar componentes remotos en layouts React.
 * Soporta wrapping de componentes React, Vue y Vanilla JS.
 * 
 * NOTA: Este archivo solo debe usarse en layouts que tengan React como sharedLib.
 */
import React from 'react';
import { createApp } from 'vue';

export type Framework = 'react' | 'vue' | 'vanilla';

export interface RemoteComponentResult {
	Component: React.ComponentType<any>;
	moduleName: string;
	timestamp: number;
}

export interface LoadRemoteComponentOptions {
	/** Función para importar dinámicamente el módulo */
	importFn: () => Promise<any>;
	/** Nombre del módulo para logs y data attributes */
	moduleName: string;
	/** Framework del módulo (react, vue, vanilla) */
	framework: Framework;
	/** Componente de error personalizado (opcional) */
	errorComponent?: (error: Error, moduleName: string) => React.ReactElement;
}

/**
 * Crea un wrapper de React para un componente Vue
 */
function createVueWrapper(
	RemoteComponent: any,
	moduleName: string,
	timestamp: number
): React.FC<any> {
	return (props: any) => {
		const containerRef = React.useRef<HTMLDivElement>(null);
		const vueAppRef = React.useRef<any>(null);

		React.useEffect(() => {
			if (containerRef.current && !vueAppRef.current) {
				vueAppRef.current = createApp(RemoteComponent, props);
				vueAppRef.current.mount(containerRef.current);
				console.log(`[Layout] Vue app montada: ${moduleName}`);
			}

			return () => {
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
				style: { display: 'contents' },
			},
			React.createElement('div', { ref: containerRef })
		);
	};
}

/**
 * Crea un wrapper de React para un componente Vanilla JS (clase con mount/unmount)
 */
function createVanillaWrapper(
	RemoteComponent: any,
	moduleName: string,
	timestamp: number
): React.FC {
	return () => {
		const containerRef = React.useRef<HTMLDivElement>(null);
		const appInstanceRef = React.useRef<any>(null);

		React.useEffect(() => {
			if (containerRef.current && !appInstanceRef.current) {
				appInstanceRef.current = new RemoteComponent();
				appInstanceRef.current.mount(containerRef.current);
				console.log(`[Layout] Vanilla JS app montada: ${moduleName}`);
			}

			return () => {
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
				style: { display: 'contents' },
			},
			React.createElement('div', { ref: containerRef })
		);
	};
}

/**
 * Crea un wrapper de React para un componente React remoto
 */
function createReactWrapper(
	RemoteComponent: any,
	moduleName: string,
	timestamp: number
): React.FC<any> {
	return (props: any) => {
		return React.createElement(
			'div',
			{
				'data-module': moduleName,
				'data-framework': 'react',
				'data-timestamp': timestamp,
				style: { display: 'contents' },
			},
			React.createElement(RemoteComponent, props)
		);
	};
}

/**
 * Componente de error por defecto (usa adc-error de la ui-library)
 */
function DefaultErrorComponent(error: Error, moduleName: string): React.ReactElement {
	let httpError: number | undefined;
	const errorMessage = error.message;

	if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CONNECTION_REFUSED')) {
		httpError = 503;
	} else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
		httpError = 404;
	}

	return React.createElement(
		'div',
		{
			'data-module': moduleName,
			'data-framework': 'error',
			'data-timestamp': Date.now(),
			style: { display: 'contents' },
		},
		React.createElement('adc-error', {
			'http-error': httpError,
			'error-title': httpError ? undefined : 'Aplicación no disponible',
			'error-description': httpError ? undefined : `En estos momentos, ${moduleName} no está disponible`,
			color: '#ef4444',
		})
	);
}

/**
 * Carga un componente remoto y lo envuelve según su framework.
 * 
 * @example
 * ```typescript
 * import { loadRemoteComponent } from '@adc/utils/react/loadRemoteComponent';
 * 
 * const result = await loadRemoteComponent({
 *   importFn: () => import('home/App'),
 *   moduleName: 'home',
 *   framework: 'vanilla',
 * });
 * ```
 */
export async function loadRemoteComponent(
	options: LoadRemoteComponentOptions
): Promise<RemoteComponentResult> {
	const { importFn, moduleName, framework, errorComponent } = options;
	const timestamp = Date.now();

	try {
		const module = await importFn();
		const RemoteComponent = module.default ?? module;

		console.log(`[Layout] Framework detectado para ${moduleName}: ${framework}`);

		let WrapperComponent: React.ComponentType<any>;

		switch (framework) {
			case 'vue':
				WrapperComponent = createVueWrapper(RemoteComponent, moduleName, timestamp);
				break;
			case 'vanilla':
				WrapperComponent = createVanillaWrapper(RemoteComponent, moduleName, timestamp);
				break;
			case 'react':
			default:
				WrapperComponent = createReactWrapper(RemoteComponent, moduleName, timestamp);
				break;
		}

		return { Component: WrapperComponent, moduleName, timestamp };
	} catch (error) {
		console.error(`[Layout] ❌ Error cargando ${moduleName}:`, error);

		const ErrorComponent = () =>
			errorComponent
				? errorComponent(error as Error, moduleName)
				: DefaultErrorComponent(error as Error, moduleName);

		return { Component: ErrorComponent, moduleName, timestamp: Date.now() };
	}
}

