const CACHE_NAME = 'adc-platform-v1';
const RUNTIME_CACHE = 'adc-runtime-v1';

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
	'/api/'
];

self.addEventListener('install', (event) => {
	self.skipWaiting(); // Forzar activación inmediata
});

self.addEventListener('activate', (event) => {
	// Limpiar caches antiguos y tomar control inmediato
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => caches.delete(cacheName))
			);
		})
	);
	return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Ignorar peticiones que no sean GET
	if (request.method !== 'GET') return;

	// Ignorar extensiones de navegador y protocolos extraños
	if (!url.protocol.startsWith('http')) return;

	// EN DESARROLLO: No cachear nada dinámico de Module Federation
	// Esto evita que se sirva código viejo de los remotos
	const isExcluded = EXCLUDED_PATHS.some(path => url.href.includes(path));
	if (isExcluded) {
		return; // Ir directo a la red
	}

	// Estrategia Stale-While-Revalidate para otros recursos
	// Pero solo si NO estamos en localhost (para desarrollo puro)
	// O si queremos probar el SW en dev, debemos ser muy cuidadosos
	
	// Si el usuario quiere probar SW en dev, permitimos cacheo de assets estáticos
	// pero forzamos red para todo lo que parezca código de aplicación en HMR
	
	const isStaticAsset = 
		url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/) ||
		url.pathname.includes('/assets/');

	if (isStaticAsset) {
		event.respondWith(staleWhileRevalidate(request));
		return;
	}

	// Para JS/CSS/HTML en desarrollo, mejor Network First para evitar bugs de HMR
	event.respondWith(networkFirst(request));
});

async function staleWhileRevalidate(request) {
	const cache = await caches.open(RUNTIME_CACHE);
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

async function networkFirst(request) {
	try {
		const networkResponse = await fetch(request);
		if (networkResponse && networkResponse.status === 200) {
			const cache = await caches.open(RUNTIME_CACHE);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		const cache = await caches.open(RUNTIME_CACHE);
		const cachedResponse = await cache.match(request);
		return cachedResponse || Response.error();
	}
}
