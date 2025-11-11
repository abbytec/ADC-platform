import { Application, RequestHandler, Request, Response, NextFunction } from "express";

/**
 * Interface para el provider de servidor HTTP
 */
export interface IHttpServerProvider {
	/**
	 * Obtiene la instancia de la aplicación Express
	 */
	getInstance(): Promise<Application>;

	/**
	 * Registra una ruta con un método HTTP específico
	 */
	registerRoute(method: string, path: string, handler: RequestHandler): void;

	/**
	 * Sirve archivos estáticos desde un directorio
	 */
	serveStatic(path: string, directory: string): void;

	/**
	 * Inicia el servidor en un puerto específico
	 */
	listen(port: number): Promise<void>;

	/**
	 * Detiene el servidor
	 */
	stop(): Promise<void>;
}

/**
 * Tipos de Express re-exportados para facilitar el uso
 */
export type { Application, RequestHandler, Request, Response, NextFunction };

