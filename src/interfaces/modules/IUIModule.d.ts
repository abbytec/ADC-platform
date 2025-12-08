/**
 * Configuración de una ruta UI para una app
 */
export interface UIRouteConfig {
	/** Ruta HTTP (ej: "/", "/users", "/products/:id") */
	path: string;
	/** Página de Astro a servir (ej: "index", "users") */
	page: string;
}

/**
 * Configuración de host para servir un módulo UI
 */
export interface UIHostConfig {
	/** Dominio base (ej: "local.com", "example.com") */
	domain: string;
	/** Lista de subdominios o "*" para comodín (ej: ["cloud", "users", "*"]) */
	subdomains?: string[];
}

/**
 * Configuración de hosting para un módulo UI en producción
 */
export interface UIHostingConfig {
	/** Configuración de hosts específicos */
	hosts?: UIHostConfig[];
	/** Lista simple de subdominios (usa dominio por defecto del sistema) */
	subdomains?: string[];
	/** Lista de dominios completos donde servir (ej: ["cloud.local.com"]) */
	domains?: string[];
}

/**
 * Configuración de un módulo UI en config.json
 */
export interface UIModuleConfig {
	/** Nombre del módulo en el import map (sin prefijo "web-") */
	name: string;
	/** Namespace UI para agrupar módulos (ej: "default", "mobile"). Default: "default" */
	uiNamespace?: string;
	/** Framework utilizado (astro, react, vue, etc.) */
	framework?: string;
	/** Directorio de salida para el build */
	outputDir: string;
	/** @deprecated Usar isHost en su lugar. Si true, genera index.html y entry point para ejecución standalone */
	standalone?: boolean;
	/** Si true, este módulo es un host de Module Federation que consume remotes */
	isHost?: boolean;
	/** Si true, este módulo se expone como remote para ser consumido por hosts */
	isRemote?: boolean;
	/** Lista de nombres de apps UI de las que depende este módulo (deben cargarse primero) */
	uiDependencies?: string[];
	/** Puerto para dev server (solo para apps React/Vue en desarrollo) */
	devPort?: number;
	/** Rutas UI que la app expone */
	routes?: UIRouteConfig[];
	/** Librerías compartidas que este módulo usa (ej: ["react", "vue"]) */
	sharedLibs?: string[];
	/** Configuración personalizada de Astro */
	astroConfig?: Record<string, any>;
	/** Habilita i18n para esta app (lee archivos de /i18n/*.js) */
	i18n?: boolean;
	/** Habilita service worker con cache stale-while-revalidate */
	serviceWorker?: boolean;
	/** Exports que este módulo expone globalmente (ej: { "loader": "./loader", "utils": "./utils" }) */
	exports?: Record<string, string>;
	/** Configuración de hosting para producción (dominios/subdominios) */
	hosting?: UIHostingConfig;
}

/**
 * Entrada en el import map
 */
export interface ImportMapEntry {
	/** Clave en el import map (ej: "ui-library", "react") */
	key: string;
	/** URL o path del módulo (ej: "/ui/ui-library/index.js") */
	url: string;
}

/**
 * Estructura completa del import map
 */
export interface ImportMap {
	imports: Record<string, string>;
	scopes?: Record<string, Record<string, string>>;
}

