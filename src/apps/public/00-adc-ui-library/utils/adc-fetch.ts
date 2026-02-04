/**
 * ADC Fetch - Error-handling wrapper for API calls
 *
 * Automatically handles errors and dispatches to adc-custom-error components.
 * Translation and HTTP fallback logic is handled by adc-custom-error.
 * Prevents unhandled rejections by catching all errors internally.
 */

import { showError, clearErrors } from "./error-handler.js";
import ADCCustomError from "@common/types/ADCCustomError.js";

export { clearErrors };

export interface AdcFetchOptions<TData = Record<string, unknown>> {
	/**
	 * Optional function to generate translation interpolation params from error data.
	 * Useful for dynamic messages like "blocked for {{time}}".
	 *
	 * @example
	 * ```ts
	 * translateParams: (data) => ({
	 *   time: formatBlockedTime(data.blockedUntil)
	 * })
	 * ```
	 */
	translateParams?: (data: TData) => Record<string, string>;
}

export interface AdcFetchResult<T> {
	/** Whether the API call succeeded */
	success: boolean;
	/** The response data if successful */
	data?: T;
	/** The error key if failed */
	errorKey?: string;
}

/**
 * Wraps an API call with automatic error handling.
 *
 * - Catches all errors (no unhandled rejections)
 * - Dispatches errors to adc-custom-error components via showError()
 * - Translation and HTTP status fallback handled by adc-custom-error
 *
 * @example
 * ```tsx
 * const result = await adcFetch(authApi.login(username, password), {
 *   translateParams: (data) => ({
 *     time: data.blockedUntil ? formatBlockedTime(data.blockedUntil) : ""
 *   })
 * });
 *
 * if (result.success) {
 *   window.location.href = redirectUrl;
 * }
 * // Errors are automatically shown - no need to handle them manually
 * ```
 */
export async function adcFetch<T, TData = Record<string, unknown>>(
	apiCall: Promise<T>,
	options: AdcFetchOptions<TData> = {}
): Promise<AdcFetchResult<T>> {
	const { translateParams } = options;

	return await apiCall
		.then((res) => ({ success: true, data: res }))
		.catch((err) => {
			const errorKey = err.errorKey || "UNKNOWN_ERROR";
			const httpStatus = err.status;

			// Extract error data and generate translation params
			let translationParams: Record<string, string> | undefined;
			if (err instanceof ADCCustomError && translateParams) {
				const errorData = (err.data || {}) as TData;
				translationParams = translateParams(errorData);
			}

			// Dispatch error to adc-custom-error components
			// Translation and HTTP fallback handled by the component
			showError({
				errorKey,
				message: err?.message || "",
				data: {
					...(err as Record<string, unknown>),
					httpStatus,
					translationParams,
				},
			});

			return { success: false, errorKey };
		});
}
