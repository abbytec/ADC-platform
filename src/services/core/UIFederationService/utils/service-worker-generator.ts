import type { RegisteredUIModule } from "../types.js";

/**
 * Genera el contenido del service worker para una app
 */
export function generateServiceWorker(module: RegisteredUIModule, namespaceModules: Map<string, RegisteredUIModule>, _port: number): string {
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
