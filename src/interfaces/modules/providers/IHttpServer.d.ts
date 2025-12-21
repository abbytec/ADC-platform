import { Application, RequestHandler, Request, Response, NextFunction } from "express";
import type { ConnectRouter } from "@connectrpc/connect";

/**
 * Configuración de host para routing basado en dominio/subdominio
 */
export interface HostConfig {
	/** Dominio base (ej: "local.com", "*.example.com") */
	domain: string;
	/** Lista de subdominios o comodín "*" para cualquiera */
	subdomains?: string[];
}

/**
 * Configuración de hosting para un módulo UI
 */
export interface UIHostingConfig {
	/** Configuración de hosts donde se sirve el módulo */
	hosts?: HostConfig[];
	/** Lista de subdominios como strings simples (usa dominio por defecto) */
	subdomains?: string[];
	/** Lista de dominios completos donde servir */
	domains?: string[];
}

/**
 * Interface para el provider de servidor HTTP
 */
export interface IHttpServerProvider {
	/**
	 * Registra una ruta con un método HTTP específico
	 */
	registerRoute(method: string, path: string, handler: RequestHandler | any): void;

	/**
	 * Sirve archivos estáticos desde un directorio
	 */
	serveStatic(path: string, directory: string): void;

	/**
	 * Inicia el servidor en un puerto específico
	 */
	listen(port: number): Promise<void>;
}

/**
 * Interface extendida para servidor HTTP con soporte de host-based routing
 */
export interface IHostBasedHttpProvider extends IHttpServerProvider {
	/**
	 * Registra un host virtual con su directorio de archivos estáticos
	 * @param hostPattern Patrón de host (ej: "*.local.com", "cloud.local.com")
	 * @param directory Directorio de archivos a servir
	 * @param options Opciones adicionales (fallback a index.html, etc)
	 */
	registerHost(hostPattern: string, directory: string, options?: HostOptions): void;

	/**
	 * Registra una ruta específica para un host
	 */
	registerHostRoute(hostPattern: string, method: string, path: string, handler: any): void;

	/**
	 * Obtiene la lista de hosts registrados
	 */
	getRegisteredHosts(): string[];

	/**
	 * Verifica si el servidor soporta host-based routing
	 */
	supportsHostRouting(): boolean;

	/**
	 * Registra rutas Connect RPC
	 * @param routes Función que define las rutas Connect RPC
	 * @param options Opciones para Connect RPC
	 */
	registerConnectRPC(routes: (router: ConnectRouter) => void, options?: { prefix?: string }): Promise<void>;
}

export interface HostOptions {
	/** Fallback a index.html para SPA routing */
	spaFallback?: boolean;
	/** Prioridad del host (mayor = más prioritario, comodines tienen menor) */
	priority?: number;
	/** Headers adicionales para las respuestas */
	headers?: Record<string, string>;
}

/**
 * Tipos de Express re-exportados para facilitar el uso
 */
export type { Application, RequestHandler, Request, Response, NextFunction };
