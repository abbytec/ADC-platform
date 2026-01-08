// Re-export response classes
export { HttpError, UncommonResponse, type CookieOptions, type SetCookie, type ClearCookie } from "./responses.js";

/** HTTP methods supported */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

/** Endpoint configuration for @RegisterEndpoint decorator */
export interface EndpointConfig {
	method: HttpMethod;
	url: string;
	permissions: string[];
	options?: EndpointOptions;
}

/** Optional endpoint configuration */
export interface EndpointOptions {
	rateLimit?: { max: number; timeWindow: string };
	schema?: {
		body?: Record<string, unknown>;
		querystring?: Record<string, unknown>;
		params?: Record<string, unknown>;
	};
	[key: string]: unknown;
}

/** Context passed to endpoint handlers */
export interface EndpointCtx<P = Record<string, string>, D = unknown> {
	params: P;
	query: Record<string, string | undefined>;
	data: D;
	user: AuthenticatedUserInfo | null;
	token: string | null;
	/** Request cookies (read-only) */
	cookies: Record<string, string | undefined>;
	/** Request headers (read-only) */
	headers: Record<string, string | undefined>;
	/** Client IP address */
	ip: string;
}

/** Authenticated user information */
export interface AuthenticatedUserInfo {
	id: string;
	username: string;
	email?: string;
	permissions: string[];
	metadata?: Record<string, unknown>;
}

/** Handler function signature */
export type EndpointHandler<P = Record<string, string>, D = unknown, R = unknown> = (ctx: EndpointCtx<P, D>) => Promise<R> | R;

/** Registered endpoint metadata */
export interface RegisteredEndpoint {
	id: string;
	method: HttpMethod;
	url: string;
	permissions: string[];
	options?: EndpointOptions;
	instance: object;
	methodName: string;
	handler: EndpointHandler<any, any, any>;
	ownerName: string;
}

/** Token verification result */
export interface TokenVerificationResult {
	valid: boolean;
	session?: { user: AuthenticatedUserInfo };
	error?: string;
}

/** EnableEndpoints configuration */
export interface EnableEndpointsConfig {
	managers?: () => object[];
}

/** Service call request */
export interface ServiceCallRequest {
	serviceName: string;
	methodName: string;
	args: unknown[];
	requiredPermissions?: string[];
	callerToken?: string;
}

/** Service call response */
export interface ServiceCallResponse<T = unknown> {
	success: boolean;
	result?: T;
	error?: string;
}
