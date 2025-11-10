/**
 * Información de un worker en el pool
 */
export interface WorkerInfo {
	worker: any;
	id: string;
	taskCount: number;
	createdAt: number;
}

/**
 * Información de carga del sistema
 */
export interface SystemLoad {
	cpuUsage: number[];
	avgLoad: number;
	freeMemory: number;
	totalMemory: number;
}

/**
 * Interfaz del ExecutionManagerService
 */
export interface IExecutionManager {
	/**
	 * Obtiene estadísticas actuales del sistema y workers
	 */
	getStats(): Promise<{
		workers: number;
		systemLoad: SystemLoad;
		activeTasks: number;
	}>;

	/**
	 * Asigna un worker óptimo a un módulo distribuido
	 */
	assignOptimalWorker(instance: any): Promise<void>;

	/**
	 * Libera un worker de un módulo
	 */
	releaseWorker(instance: any): void;
}

