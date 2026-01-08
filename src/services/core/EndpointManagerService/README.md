# EndpointManagerService

Gestión centralizada de endpoints HTTP con validación de permisos.

## Características

-   `@RegisterEndpoint`: Declara endpoints HTTP con permisos requeridos
-   `@EnableEndpoints`: Activa registro de endpoints al iniciar servicio
-   `@DisableEndpoints`: Limpia endpoints al detener servicio
-   Validación automática de tokens via SessionManagerService
-   Comunicación inter-servicios con `ctx.callService()`

## Uso

```typescript
import { EnableEndpoints, DisableEndpoints, RegisterEndpoint } from "../../core/EndpointManagerService/index.js";

class MyService extends BaseService {
	@RegisterEndpoint({ method: "GET", url: "/api/data", permissions: ["data.read"] })
	async getData(req, reply, ctx) {
		/* ... */
	}

	@EnableEndpoints()
	async start(k) {
		await super.start(k);
	}

	@DisableEndpoints()
	async stop(k) {
		await super.stop(k);
	}
}
```
