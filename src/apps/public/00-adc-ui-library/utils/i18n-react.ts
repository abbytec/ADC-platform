/**
 * React hooks for ADC i18n system
 *
 * Use these hooks to access translations loaded by the ADC i18n client.
 */

import { useState, useEffect, useCallback, useMemo } from "react";

interface ADCGlobal {
	__ADC_I18N__?: {
		translations: Record<string, Record<string, unknown>>;
		locale: string | null;
		loading: boolean;
		loaded: boolean;
	};
	t?: (key: string, params?: Record<string, string> | null, namespace?: string) => string;
	loadTranslations?: (namespaces: string[], locale?: string) => Promise<void>;
	getLocale?: () => string;
	setLocale?: (locale: string) => void;
}
const customThis = globalThis as typeof globalThis & ADCGlobal;

export interface UseTranslationOptions {
	/** Namespace(s) to load translations from */
	namespace?: string | string[];
	/** If true, automatically load translations on mount */
	autoLoad?: boolean;
}

export interface UseTranslationReturn {
	/** Translation function */
	t: (key: string, params?: Record<string, string>) => string;
	/** Current locale */
	locale: string;
	/** Whether translations are loaded */
	ready: boolean;
	/** Change locale */
	setLocale: (locale: string) => void;
}

/**
 * React hook for accessing translations
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { t, ready } = useTranslation({ namespace: "adc-auth", autoLoad: true });
 *
 *   if (!ready) return <div>Loading...</div>;
 *
 *   return (
 *     <form>
 *       <h1>{t("login.title")}</h1>
 *       <input placeholder={t("login.username")} />
 *     </form>
 *   );
 * }
 * ```
 */
export function useTranslation(options: UseTranslationOptions = {}): UseTranslationReturn {
	const { namespace, autoLoad = true } = options;

	// Estabilizar namespaces para evitar re-renders infinitos
	const namespacesKey = Array.isArray(namespace) ? namespace.join(",") : namespace || "";
	const namespaces = useMemo(() => {
		return Array.isArray(namespace) ? namespace : namespace ? [namespace] : [];
	}, [namespacesKey]);

	// Counter para forzar re-cálculo de t() cuando las traducciones cambian
	const [translationsVersion, setTranslationsVersion] = useState(0);

	const [ready, setReady] = useState(() => {
		// Check if translations are already loaded
		// Nota: usamos namespace directamente aquí porque namespaces aún no está calculado
		const ns = Array.isArray(namespace) ? namespace : namespace ? [namespace] : [];
		const state = customThis.__ADC_I18N__;
		if (!state || ns.length === 0) return false;
		return ns.every((n) => n in state.translations);
	});

	const [locale, setLocale] = useState(() => {
		return customThis.__ADC_I18N__?.locale || localStorage.getItem("language") || navigator.language?.split("-")[0] || "en";
	});

	// Translation function
	const t = useCallback(
		(key: string, params?: Record<string, string>): string => {
			// Use global t() if available
			if (customThis.t) {
				const ns = namespaces[0];
				return customThis.t(key, params || null, ns);
			}

			// Fallback: direct lookup
			const state = customThis.__ADC_I18N__;
			if (!state) return key;

			const ns = namespaces[0];
			const translations = ns ? state.translations[ns] : Object.values(state.translations)[0];
			if (!translations) return key;

			const keys = key.split(".");
			let value: unknown = translations;
			for (const k of keys) {
				if (value && typeof value === "object" && k in value) {
					value = (value as Record<string, unknown>)[k];
				} else {
					return key;
				}
			}

			if (typeof value !== "string") return key;

			// Interpolation
			if (params) {
				return value.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p] ?? `{{${p}}}`);
			}

			return value;
		},
		[namespaces, translationsVersion]
	);

	// Set locale function
	const setLocaleFn = useCallback((newLocale: string) => {
		if (customThis.setLocale) {
			customThis.setLocale(newLocale);
		} else {
			localStorage.setItem("language", newLocale);
		}
		setLocale(newLocale);
	}, []);

	// Load translations on mount
	useEffect(() => {
		if (!autoLoad || namespaces.length === 0) {
			setReady(true);
			return;
		}

		let cancelled = false;

		const loadIfNeeded = async () => {
			// Esperar a que customThis.loadTranslations esté disponible (max 5s)
			let retries = 0;
			const maxRetries = 50;
			while (!customThis.loadTranslations && retries < maxRetries) {
				await new Promise((r) => setTimeout(r, 100));
				retries++;
			}

			if (cancelled) return;

			const state = customThis.__ADC_I18N__;
			const allLoaded = state && namespaces.every((ns) => ns in state.translations);

			if (!allLoaded && customThis.loadTranslations) {
				try {
					await customThis.loadTranslations(namespaces);
				} catch (err) {
					console.error("[i18n-react] Error loading translations:", err);
				}
			}

			if (!cancelled) {
				setReady(true);
				// Incrementar version para forzar re-cálculo de t()
				setTranslationsVersion((v) => v + 1);
			}
		};

		loadIfNeeded();

		return () => {
			cancelled = true;
		};
	}, [autoLoad, namespaces]);

	// Listen for locale changes
	useEffect(() => {
		const handleI18nLoaded = (event: Event) => {
			const detail = (event as CustomEvent).detail;
			if (detail?.locale) {
				setLocale(detail.locale);
			}
			setReady(true);
			// Forzar re-cálculo de t() cuando cambian traducciones
			setTranslationsVersion((v) => v + 1);
		};

		customThis.addEventListener("adc:i18n:loaded", handleI18nLoaded);
		return () => customThis.removeEventListener("adc:i18n:loaded", handleI18nLoaded);
	}, []);

	return { t, locale, ready, setLocale: setLocaleFn };
}

/**
 * Get a translation key with a fallback
 * Useful for error messages where you want to show the errorKey as fallback
 */
export function getErrorMessage(
	t: (key: string, params?: Record<string, string>) => string,
	errorKey: string,
	fallbackMessage?: string
): string {
	const translated = t(`errors.${errorKey}`);
	// If translation returns the key itself, use fallback
	if (translated === `errors.${errorKey}`) {
		return fallbackMessage || errorKey;
	}
	return translated;
}
