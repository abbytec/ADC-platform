/**
 * Configuración de una librería compartida
 */
export interface SharedLibConfig {
	/** Nombre de la librería (react, vue, etc.) */
	library: string;
	/** Versión de la librería */
	version: string;
	/** Mapeo de claves de import map a URLs */
	importMapKeys: Record<string, string>;
	/** Fuente CDN (ej: https://esm.sh) */
	cdnSource?: string;
	/** Si debe usar archivos locales en lugar de CDN */
	useLocal?: boolean;
}

/**
 * Interface del servicio SharedLibs
 */
export interface ISharedLibsService {
	/**
	 * Obtiene la configuración de la librería
	 */
	getConfig(): SharedLibConfig;

	/**
	 * Descarga la librería desde el CDN
	 */
	download(): Promise<void>;

	/**
	 * Verifica si la librería está lista
	 */
	isReady(): boolean;
}

