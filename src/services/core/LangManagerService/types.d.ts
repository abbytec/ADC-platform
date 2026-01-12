/**
 * Traducciones de un locale específico
 */
export type TranslationDict = Record<string, string | TranslationDict>;

/**
 * Traducciones registradas por namespace (app name)
 */
export interface NamespaceTranslations {
	[locale: string]: TranslationDict;
}

/**
 * Información de un namespace registrado
 */
export interface RegisteredNamespace {
	name: string;
	appDir: string;
	locales: string[];
	translations: NamespaceTranslations;
	/** Dependencias de i18n (namespaces cuyos translations se heredan) */
	dependencies?: string[];
}

/**
 * Interface pública del LangManagerService
 */
export interface ILangManagerService {
	/**
	 * Registra las traducciones de una app
	 * @param dependencies - Namespaces cuyas traducciones se heredarán (deep merge)
	 */
	registerNamespace(namespace: string, appDir: string, dependencies?: string[]): Promise<void>;

	/**
	 * Desregistra las traducciones de una app
	 */
	unregisterNamespace(namespace: string): Promise<void>;

	/**
	 * Obtiene una traducción específica
	 */
	t(namespace: string, key: string, locale?: string, params?: Record<string, string>): string;

	/**
	 * Obtiene todas las traducciones de un namespace para un locale
	 * (incluye traducciones de dependencias con deep merge)
	 */
	getTranslations(namespace: string, locale?: string): TranslationDict;

	/**
	 * Obtiene las traducciones combinadas de múltiples namespaces
	 */
	getBundledTranslations(namespaces: string[], locale?: string): Record<string, TranslationDict>;

	/**
	 * Obtiene los locales disponibles para un namespace
	 */
	getAvailableLocales(namespace: string): string[];

	/**
	 * Obtiene el locale actual
	 */
	getCurrentLocale(): string;

	/**
	 * Establece el locale actual
	 */
	setCurrentLocale(locale: string): void;

	/**
	 * Obtiene estadísticas del servicio
	 */
	getStats(): {
		namespaces: number;
		totalTranslations: number;
		currentLocale: string;
		registeredNamespaces: string[];
	};
}
