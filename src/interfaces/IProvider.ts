export interface IProvider<T> {
	/**
	 * El Symbol que identifica la capacidad que este
	 * proveedor implementa. (Ej: STORAGE_CAPABILITY)
	 */
	capability: symbol;

	/**
	 * El Kernel llamará a esta función para obtener la instancia
	 * concreta que será registrada.
	 * Puede ser asíncrona si necesita conectarse a una DB, etc.
	 */
	getInstance(options?: any): Promise<T> | T;

	/**
	 * (Opcional) El Kernel llamará a esto al descargar el proveedor.
	 * Útil para cerrar conexiones.
	 */
	shutdown?(): Promise<void>;
}
