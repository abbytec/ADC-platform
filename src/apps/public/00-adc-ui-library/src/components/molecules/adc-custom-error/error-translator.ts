/**
 * Translation utilities for error messages
 */

import type { ADCErrorEvent } from "./types.js";

/** Global translate function from ADC i18n system */
function t(key: string, params?: Record<string, string>): string {
	return (window as { t?: (k: string, p?: Record<string, string>) => string }).t?.(key, params) ?? key;
}

const ERROR_PREFIX = "errors.";

/**
 * Resolves the display message for an error:
 * 1. Try translating errorKey with params
 * 2. Fall back to HTTP status translation if available
 * 3. Fall back to raw message or generic error
 */
export function resolveErrorMessage(errorData: ADCErrorEvent): string {
	const { errorKey, message, data } = errorData;
	const translatedKey = `${ERROR_PREFIX}${errorKey}`;
	const resolved = t(translatedKey, data?.translationParams);

	// If translation returned the key itself, it wasn't found
	if (resolved === translatedKey) {
		// Try HTTP status fallback
		if (data?.httpStatus) {
			const httpKey = `${ERROR_PREFIX}http.${data.httpStatus}`;
			const httpMsg = t(httpKey);
			if (httpMsg !== httpKey) return httpMsg;
		}
		// Fall back to raw message or generic error
		return message || t(`${ERROR_PREFIX}UNKNOWN_ERROR`) || "An unexpected error occurred";
	}

	return resolved;
}
