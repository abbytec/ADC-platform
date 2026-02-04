/**
 * ADC Fetch - Error-handling wrapper and API factory for frontend calls
 *
 * Features:
 * - Automatic error handling with adc-custom-error components
 * - API factory with configurable base URL and credentials
 * - Built-in dev/prod URL resolution
 * - Type-safe request/response handling
 */

import { showError, clearErrors } from "./error-handler.js";
import ADCCustomError, { HttpError } from "@common/types/ADCCustomError.js";

export { clearErrors };

export interface AdcFetchResult<T> {
	success: boolean;
	data?: T;
	errorKey?: string;
}

export interface AdcApiConfig {
	basePath: string;
	/**
	 * Dev server port - used when NODE_ENV === "development"
	 * If not provided, uses same origin in both dev and prod
	 */
	devPort?: number;
	/**
	 * Credentials mode for fetch requests
	 * @default "same-origin" (safer than "include" for same-domain requests)
	 */
	credentials?: RequestCredentials;
	headers?: HeadersInit;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions<TData = Record<string, unknown>> {
	/** Query parameters */
	params?: Record<string, string | number | boolean | undefined | null>;
	/** Request body (auto-serialized to JSON) */
	body?: unknown;
	/** Additional headers for this request */
	headers?: HeadersInit;
	/** Translation params generator for error handling */
	translateParams?: (data: TData) => Record<string, string>;
}

// Detect dev mode: check for localhost hostname
const IS_DEV = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location?.hostname);

/**
 * Builds a query string from an object, filtering out undefined/null values
 */
function buildQueryString(params?: Record<string, string | number | boolean | undefined | null>): string {
	if (!params) return "";
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) {
			searchParams.append(key, String(value));
		}
	}
	const str = searchParams.toString();
	return str ? `?${str}` : "";
}

/**
 * Parses error response and throws ADCCustomError
 */
async function parseErrorResponse(response: Response): Promise<never> {
	let errorData: Record<string, unknown> = {};
	try {
		errorData = await response.json();
	} catch {
		// Response body not JSON, use status text
	}

	const error = new HttpError(
		(errorData.status as number) || response.status,
		(errorData.errorKey as string) || "HTTP_ERROR",
		(errorData.message as string) || response.statusText || "Error desconocido",
		errorData.data as Record<string, unknown>
	);
	throw error;
}

/**
 * Creates a configured API client with automatic error handling.
 *
 * @example
 * ```ts
 * // Create API instance
 * const authApi = createAdcApi({
 *   basePath: "/api/auth",
 *   devPort: 3000,
 *   credentials: "same-origin"
 * });
 *
 * // Use it
 * const result = await authApi.post<AuthResponse>("/login", {
 *   body: { username, password }
 * });
 *
 * if (result.success) {
 *   console.log(result.data.user);
 * }
 * ```
 */
export function createAdcApi(config: AdcApiConfig) {
	const { basePath, devPort, credentials = "same-origin", headers: defaultHeaders } = config;

	// Build base URL based on environment
	const baseUrl = IS_DEV && devPort ? `http://${window.location.hostname}:${devPort}${basePath}` : basePath;

	async function request<T, TData = Record<string, unknown>>(
		method: HttpMethod,
		path: string,
		options: RequestOptions<TData> = {}
	): Promise<AdcFetchResult<T>> {
		const { params, body, headers, translateParams } = options;

		const url = `${baseUrl}${path}${buildQueryString(params)}`;

		const fetchOptions: RequestInit = {
			method,
			credentials,
			headers: {
				...defaultHeaders,
				...(body !== undefined ? { "Content-Type": "application/json" } : {}),
				...headers,
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		};

		try {
			const response = await fetch(url, fetchOptions);

			if (!response.ok) {
				await parseErrorResponse(response);
			}

			const data = (await response.json()) as T;
			return { success: true, data };
		} catch (err) {
			const errorKey = (err as ADCCustomError).errorKey || "UNKNOWN_ERROR";
			const httpStatus = (err as ADCCustomError).status;

			// Extract error data and generate translation params
			let translationParams: Record<string, string> | undefined;
			if (err instanceof ADCCustomError && translateParams) {
				const errorData = (err.data || {}) as TData;
				translationParams = translateParams(errorData);
			}

			// Dispatch error to adc-custom-error components
			showError({
				errorKey,
				message: (err as Error)?.message || "",
				data: {
					...(err as Record<string, unknown>),
					httpStatus,
					translationParams,
				},
			});

			return { success: false, errorKey };
		}
	}

	return {
		get: <T, TData = Record<string, unknown>>(path: string, options?: RequestOptions<TData>) => request<T, TData>("GET", path, options),
		post: <T, TData = Record<string, unknown>>(path: string, options?: RequestOptions<TData>) => request<T, TData>("POST", path, options),
		put: <T, TData = Record<string, unknown>>(path: string, options?: RequestOptions<TData>) => request<T, TData>("PUT", path, options),
		patch: <T, TData = Record<string, unknown>>(path: string, options?: RequestOptions<TData>) => request<T, TData>("PATCH", path, options),
		delete: <T, TData = Record<string, unknown>>(path: string, options?: RequestOptions<TData>) =>
			request<T, TData>("DELETE", path, options),
		/** Raw request with full control */
		request,
		/** The resolved base URL */
		baseUrl,
	};
}
