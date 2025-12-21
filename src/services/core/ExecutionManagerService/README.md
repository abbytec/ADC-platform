# ExecutionManagerService

Servicio en modo kernel que gestiona la ejecución distribuida de módulos.

## Funcionalidades

-   **Pool de Workers Dinámico:** Administra workers automáticamente según la carga del sistema
-   **Monitoreo de Recursos:** Mide CPU y memoria en tiempo real
-   **Distribución Inteligente:** Asigna workers óptimos según carga actual
-   **Balanceo de Carga:** Distribuye tareas entre workers disponibles
-   **Escalado Automático:** Crea/termina workers según necesidad

## Preparado para Clusterización

El sistema está diseñado para soportar nodos remotos en el futuro:

-   Arquitectura agnóstica al tipo de ejecutor (worker local / nodo remoto)
-   Sistema de mensajería compatible con comunicación remota
-   Interfaces preparadas para distribución geográfica

## Uso con el Decorador @Distributed

```typescript
import { Distributed } from "../../utils/decorators/Distributed.js";
import { BaseService } from "../BaseService.js";

@Distributed
export default class MyHeavyService extends BaseService<IMyService> {
	public readonly name = "my-heavy-service";

	async heavyComputation(data: any): Promise<any> {
		// Este método puede ejecutarse en un worker si el ExecutionManager lo asigna
		// El decorador intercepta la llamada y decide dónde ejecutarla
		return processData(data);
	}
}
```

## API del Servicio

```typescript
interface IExecutionManager {
	// Obtener estadísticas del sistema
	getStats(): Promise<{
		workers: number;
		systemLoad: SystemLoad;
		activeTasks: number;
	}>;

	// Asignar worker óptimo a un módulo
	assignOptimalWorker(instance: any): Promise<void>;

	// Liberar worker de un módulo
	releaseWorker(instance: any): void;
}
```

## Configuración

El servicio se configura mediante `config.json`:

```json
{
	"global": true,
	"kernelMode": true,
	"failOnError": true,
	"custom": {
		"minWorkers": 2,
		"maxWorkers": 4
	}
}
```

-   **kernelMode:** Indica que el servicio se carga durante la inicialización del kernel
-   **minWorkers:** Número mínimo de workers en el pool
-   **maxWorkers:** Número máximo de workers (por defecto CPUs - 1)

## Algoritmo de Distribución

1. **Carga Baja:** Si la carga del sistema es baja, ejecutar localmente
2. **Worker Disponible:** Asignar el worker con menos tareas
3. **Workers Saturados:** Si todos están ocupados y no se alcanzó el máximo, crear un nuevo worker
4. **Monitoreo Continuo:** Cada 5 segundos revisa la carga:
    - Carga alta (>80%): Crear workers adicionales
    - Carga baja (<30%): Terminar workers ociosos

## Ejemplo de Uso

```typescript
// Desde una app o servicio
const execManager = kernel.getService<IExecutionManager>("execution-manager");

// Obtener estadísticas
const stats = await execManager.getStats();
console.log(`Workers activos: ${stats.workers}`);
console.log(`Carga promedio: ${(stats.systemLoad.avgLoad * 100).toFixed(1)}%`);

// Asignar worker a un servicio distribuido
await execManager.assignOptimalWorker(myService);

// Ahora las llamadas a myService se ejecutan en el worker asignado
await myService.heavyComputation(data);

// Liberar el worker cuando ya no se necesite
execManager.releaseWorker(myService);
```
