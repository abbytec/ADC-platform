import { RegisteredUIModule } from "../types.js";

/**
 * Genera el código de inicialización del cliente para i18n y SW
 */
export function generateI18nClientCode(module: RegisteredUIModule, namespaceModules: Map<string, RegisteredUIModule>, _port: number): string {
	const namespace = module.namespace;
	const hasServiceWorker = module.uiConfig.serviceWorker === true;

	// Obtener los namespaces de i18n de los módulos del mismo namespace
	const i18nNamespaces: string[] = [];
	for (const [name, mod] of namespaceModules.entries()) {
		if (mod.uiConfig.i18n) {
			i18nNamespaces.push(name);
		}
	}

	const isDev = process.env.NODE_ENV === "development";

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
	
	${
		hasServiceWorker
			? `
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
		${
			isDev
				? `
		navigator.serviceWorker.getRegistrations().then(registrations => {
			for (const registration of registrations) {
				if (registration.active && !registration.active.scriptURL.includes('adc-sw.js')) {
					registration.unregister();
					console.log('[SW] SW antiguo desregistrado');
				}
			}
		});
		`
				: ""
		}
	} else {
		console.warn('[SW] Service Workers solo estan disponible en localhost o https');
	}
	`
			: "// Service Worker deshabilitado para este módulo"
	}
})();
`;
}
