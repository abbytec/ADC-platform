import type { RegisteredUIModule } from "../types.js";

/**
 * Genera el contenido del service worker para una app
 */
export function generateServiceWorker(
	module: RegisteredUIModule,
	namespaceModules: Map<string, RegisteredUIModule>,
	_port: number
): string {
	const namespace = module.namespace;
	const moduleName = module.name;
	
	// Obtener los namespaces de i18n de los módulos del mismo namespace
	const i18nNamespaces: string[] = [];
	for (const [name, mod] of namespaceModules.entries()) {
		if (mod.uiConfig.i18n) {
			i18nNamespaces.push(name);
		}
	}

	return `// Service Worker generado por UIFederationService
// Namespace: ${namespace} | Módulo: ${moduleName}
const CACHE_NAME = 'adc-${namespace}-v1';
const RUNTIME_CACHE = 'adc-runtime-${namespace}-v1';
const I18N_CACHE = 'adc-i18n-${namespace}-v1';

// URLs estáticas a cachear
const CACHE_URLS = [
	'/',
];

// Archivos que NUNCA se deben cachear (crítico para Module Federation y HMR)
const EXCLUDED_PATHS = [
	'remoteEntry.js',
	'mf-manifest.json',
	'.hot-update.js',
	'.hot-update.json',
	'__federation_expose_App',
	'/api/',
	'adc-sw.js',
	'adc-i18n.js'
];

// Namespaces i18n disponibles
const I18N_NAMESPACES = ${JSON.stringify(i18nNamespaces)};

self.addEventListener('install', (event) => {
	console.log('[SW ${namespace}] Instalando...');
	self.skipWaiting(); // Forzar activación inmediata
});

self.addEventListener('activate', (event) => {
	console.log('[SW ${namespace}] Activando...');
	// Limpiar caches antiguos de otros namespaces/versiones
	event.waitUntil(
		caches.keys().then(keys => {
			return Promise.all(
				keys.filter(key => {
					// Mantener solo caches de este namespace y versión actual
					return key.startsWith('adc-') && 
						!key.includes('${namespace}') ||
						(key.includes('${namespace}') && key !== CACHE_NAME && key !== RUNTIME_CACHE && key !== I18N_CACHE);
				}).map(key => caches.delete(key))
			);
		}).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Ignorar peticiones que no sean GET
	if (request.method !== 'GET') return;

	// Ignorar extensiones de navegador y protocolos extraños
	if (!url.protocol.startsWith('http')) return;

	// CRÍTICO: No cachear archivos de Module Federation y HMR
	const isExcluded = EXCLUDED_PATHS.some(path => url.href.includes(path));
	if (isExcluded) {
		return; // Ir directo a la red
	}

	// NO cachear imágenes
	const isImage = url.pathname.match(/\\.(png|jpg|jpeg|gif|svg|ico|webp|avif)$/);
	if (isImage) {
		return; // No cachear imágenes
	}

	// Stale-while-revalidate para traducciones i18n
	if (url.pathname.startsWith('/api/i18n')) {
		event.respondWith(staleWhileRevalidate(request, I18N_CACHE));
		return;
	}

	// Stale-while-revalidate para JS/CSS/HTML de apps federadas
	const isAppAsset = url.pathname.match(/\\.(js|css|html)$/) || 
		url.pathname === '/' ||
		!url.pathname.includes('.');
	
	if (isAppAsset) {
		event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
		return;
	}

	// Fuentes: cache-first (raramente cambian)
	const isFont = url.pathname.match(/\\.(woff2?|ttf|eot)$/);
	if (isFont) {
		event.respondWith(cacheFirst(request, RUNTIME_CACHE));
		return;
	}
});

async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	const fetchPromise = fetch(request)
		.then((networkResponse) => {
			if (networkResponse && networkResponse.status === 200) {
				cache.put(request, networkResponse.clone());
			}
			return networkResponse;
		})
		.catch(() => cachedResponse);

	return cachedResponse || fetchPromise;
}

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);
	
	if (cachedResponse) {
		return cachedResponse;
	}
	
	try {
		const networkResponse = await fetch(request);
		if (networkResponse && networkResponse.status === 200) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		return Response.error();
	}
}

// Mensaje para precargar traducciones
self.addEventListener('message', async (event) => {
	if (event.data.type === 'PRELOAD_I18N') {
		const { locale, namespaces } = event.data;
		const cache = await caches.open(I18N_CACHE);
		
		for (const ns of (namespaces || I18N_NAMESPACES)) {
			// Usar URL relativa al origen del SW
			const url = \`/api/i18n/\${ns}?locale=\${locale}\`;
			try {
				const response = await fetch(url);
				if (response.ok) {
					await cache.put(url, response);
					console.log('[SW ${namespace}] i18n precargado:', ns, locale);
				}
			} catch (e) {
				console.warn('[SW ${namespace}] Error precargando i18n:', ns, e);
			}
		}
		
		event.source?.postMessage({ type: 'I18N_PRELOADED' });
	}
});
`;
}

/**
 * Genera el código de inicialización del cliente para i18n y SW
 */
export function generateI18nClientCode(
	module: RegisteredUIModule,
	namespaceModules: Map<string, RegisteredUIModule>,
	_port: number
): string {
	const namespace = module.namespace;
	const hasServiceWorker = module.uiConfig.serviceWorker === true;
	
	// Obtener los namespaces de i18n de los módulos del mismo namespace
	const i18nNamespaces: string[] = [];
	for (const [name, mod] of namespaceModules.entries()) {
		if (mod.uiConfig.i18n) {
			i18nNamespaces.push(name);
		}
	}

	const isDev = process.env.NODE_ENV === 'development';

	return `// ADC i18n Client - Namespace: ${namespace}
(function() {
	const I18N_NAMESPACES = ${JSON.stringify(i18nNamespaces)};
	const STORAGE_KEY = 'language';
	
	// Estado global de traducciones
	window.__ADC_I18N__ = window.__ADC_I18N__ || {
		translations: {},
		locale: null,
		loading: false,
		loaded: false,
	};
	
	// Detectar locale: localStorage > navegador > 'en'
	function detectLocale() {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return stored;
		
		const browserLang = navigator.language || navigator.languages?.[0] || 'en';
		return browserLang.split('-')[0];
	}
	
	// Función t() global para traducciones
	window.t = function(key, params, namespace) {
		const state = window.__ADC_I18N__;
		const ns = namespace || I18N_NAMESPACES[0] || 'default';
		const translations = state.translations[ns] || {};
		
		const keys = key.split('.');
		let value = translations;
		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = value[k];
			} else {
				return key;
			}
		}
		
		if (typeof value !== 'string') return key;
		
		if (params) {
			return value.replace(/\\{\\{(\\w+)\\}\\}/g, (_, p) => params[p] ?? \`{{\${p}}}\`);
		}
		
		return value;
	};
	
	// Cargar traducciones
	async function loadTranslations(locale) {
		const state = window.__ADC_I18N__;
		if (state.loading) return;
		
		state.loading = true;
		state.locale = locale;
		
		try {
			for (const ns of I18N_NAMESPACES) {
				const url = \`/api/i18n/\${ns}?locale=\${locale}\`;
				const response = await fetch(url);
				if (response.ok) {
					state.translations[ns] = await response.json();
				}
			}
			state.loaded = true;
			console.log('[i18n] Traducciones cargadas:', Object.keys(state.translations));
			
			window.dispatchEvent(new CustomEvent('adc:i18n:loaded', { 
				detail: { locale, namespaces: Object.keys(state.translations) }
			}));
		} catch (error) {
			console.error('[i18n] Error cargando traducciones:', error);
		} finally {
			state.loading = false;
		}
	}
	
	// Cambiar locale
	window.setLocale = function(locale) {
		localStorage.setItem(STORAGE_KEY, locale);
		loadTranslations(locale);
		
		if (navigator.serviceWorker?.controller) {
			navigator.serviceWorker.controller.postMessage({
				type: 'PRELOAD_I18N',
				locale: locale,
				namespaces: I18N_NAMESPACES
			});
		}
	};
	
	// Obtener locale actual
	window.getLocale = function() {
		return window.__ADC_I18N__.locale || detectLocale();
	};
	
	// Inicializar
	const initialLocale = detectLocale();
	loadTranslations(initialLocale);
	
	${hasServiceWorker ? `
	// Registrar Service Worker
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('/adc-sw.js')
				.then((registration) => {
					console.log('[SW] Service Worker registrado:', registration.scope);
					
					navigator.serviceWorker.ready.then(() => {
						if (navigator.serviceWorker.controller) {
							navigator.serviceWorker.controller.postMessage({
								type: 'PRELOAD_I18N',
								locale: initialLocale,
								namespaces: I18N_NAMESPACES
							});
						}
					});
				})
				.catch((error) => {
					console.error('[SW] Error registrando Service Worker:', error);
				});
		});
		
		// Limpiar SWs viejos en desarrollo
		${isDev ? `
		navigator.serviceWorker.getRegistrations().then(registrations => {
			for (const registration of registrations) {
				if (registration.active && !registration.active.scriptURL.includes('adc-sw.js')) {
					registration.unregister();
					console.log('[SW] SW antiguo desregistrado');
				}
			}
		});
		` : ''}
	} else {
		console.warn('[SW] Service Workers solo estan disponible en localhost o https');
	}
	` : '// Service Worker deshabilitado para este módulo'}
})();
`;
}
