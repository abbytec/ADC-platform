/**
 * Utilidad para realizar requests Connect RPC
 * Proporciona una interfaz simple para consumir servicios Connect RPC
 */

export interface RPCRequestOptions {
	service: string;
	method: string;
	body?: any;
	baseUrl?: string;
}

export interface RPCResponse<T = any> {
	data: T | null;
	error: string | null;
}

/**
 * Cliente Connect RPC simplificado
 */
export class ConnectRPCClient {
	private baseUrl: string;

	constructor(baseUrl: string = "/api/rpc") {
		this.baseUrl = baseUrl;
	}

	/**
	 * Realiza un request Connect RPC
	 */
	async call<TResponse = any>(service: string, method: string, body?: any): Promise<RPCResponse<TResponse>> {
		try {
			const url = `${this.baseUrl}/${service}/${method}`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: body ? JSON.stringify(body) : undefined,
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					data: null,
					error: `HTTP ${response.status}: ${errorText}`,
				};
			}

			const data = await response.json();

			return {
				data,
				error: null,
			};
		} catch (error: any) {
			return {
				data: null,
				error: error.message || "Request failed",
			};
		}
	}
}

/**
 * Cliente singleton para Connect RPC
 * En desarrollo, las APIs están en el puerto 3000 (servidor principal)
 * En producción, están en el mismo origen
 */
const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
const apiBaseUrl = isDevelopment ? "http://localhost:3000/api/rpc" : "/api/rpc";
export const rpcClient = new ConnectRPCClient(apiBaseUrl);

/**
 * Hook-style helper para usar en componentes
 */
export async function useRPC<TResponse = any>(
	service: string,
	method: string,
	body?: any
): Promise<RPCResponse<TResponse>> {
	return rpcClient.call<TResponse>(service, method, body);
}
