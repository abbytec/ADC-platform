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

## Respuestas HTTP

### HttpError

```typescript
// Error 404
throw new HttpError(404, "NOT_FOUND", "User does not exist");

// Error de validación con datos adicionales
throw new HttpError(400, "VALIDATION_ERROR", "Invalid email", { field: "email" });
```

### UncommonResponse

```typescript
// Redirect con cookies (OAuth callback)
throw UncommonResponse.redirect("/dashboard", {
	cookies: [{ name: "token", value: jwt, options: { httpOnly: true } }],
});

// JSON con cookies (login)
throw UncommonResponse.json(
	{ success: true, user },
	{
		cookies: [{ name: "access_token", value: token }],
	}
);

// Limpiar cookies (logout)
throw UncommonResponse.json(
	{ success: true },
	{
		clearCookies: [{ name: "access_token", options: { path: "/" } }],
	}
);
```
