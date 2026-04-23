# Endpoints — Plantilla para crear un servicio

Este documento define cómo diseñar la capa HTTP de un servicio nuevo desde cero. El objetivo es que todos los endpoints tengan la misma forma, responsabilidades claras y un flujo predecible.

## Objetivo de la capa

Los endpoints son adaptadores. Reciben HTTP, validan shape básico, resuelven contexto y delegan al servicio o al DAO. No contienen reglas de negocio ni acceso directo a persistencia.

## Estructura mínima

```text
src/services/<layer>/<MyService>/
├── endpoints/
│   ├── index.ts
│   ├── resources.ts
│   └── operations.ts
└── index.ts
```

- Un archivo por grupo de rutas.
- Separar CRUD de operaciones especiales si mejora la lectura.
- Mantener nombres alineados con el recurso expuesto.

## Contrato recomendado

```ts
import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import type MyService from "../index.js";
import { MyServiceError } from "@common/types/custom-errors/MyServiceError.ts";

export class ResourceEndpoints {
	static #service: MyService;
	static #kernelKey: symbol;

	static init(service: MyService, kernelKey: symbol): void {
		ResourceEndpoints.#service ??= service;
		ResourceEndpoints.#kernelKey ??= kernelKey;
	}
}
```

- La clase de endpoints es estática.
- `#service` y `#kernelKey` se asignan una sola vez.
- `init()` se llama durante `start()` del servicio.

## Flujo de un endpoint

Cada handler debería seguir este orden:

1. Validar presencia y tipo básico de los campos de entrada.
2. Normalizar input simple si corresponde.
3. Resolver contexto del caller si el caso lo requiere.
4. Eliminar campos no confiables del body.
5. Delegar a la capa de negocio.
6. Devolver una respuesta simple y estable.

## Qué valida el endpoint

Validaciones que sí van acá:

- Campos requeridos.
- Tipos primitivos.
- Arrays y enums básicos.
- Conversión de strings vacíos, trims y lowercase cuando aplique.

Validaciones que no van acá:

- Permisos finos.
- Límites de negocio.
- Reglas entre múltiples entidades.
- Persistencia.

## Estrategias de autorización

Hay dos patrones válidos:

### 1. Gate temprano en el router

Usar `permissions: [...]` cuando el endpoint sólo tiene una vía de acceso posible y siempre requiere permiso formal antes de ejecutar lógica.

```ts
@RegisterEndpoint({ method: "GET", url: "/api/my-service/stats", permissions: [P.MY_SERVICE.READ_STATS] })
```

### 2. Autorización delegada a la capa de negocio

Usar `deferAuth: true` cuando la autorización depende del recurso, del owner, de membresías o de reglas que requieren cargar contexto.

```ts
@RegisterEndpoint({ method: "PATCH", url: "/api/my-service/resources/:id", deferAuth: true })
```

Regla práctica:

- Si el permiso depende sólo del rol global, usar `permissions`.
- Si depende del estado del recurso o del caller sobre ese recurso, usar `deferAuth: true`.

## Contexto del caller

Si varios endpoints necesitan el mismo contexto calculado, resolverlo una vez en el servicio y cachearlo sobre `ctx`.

```ts
const cacheKey = Symbol.for("MyServiceCallerCtx");
const cached = (ctx as any)[cacheKey];
if (cached) return cached;

const caller = { userId: ctx.user?.id, groupIds: [] };
Object.defineProperty(ctx, cacheKey, { value: caller, enumerable: false });
return caller;
```

- El cálculo del contexto vive en el servicio, no en cada endpoint.
- Si ese método es interno al kernel, protegerlo con `@OnlyKernel()`.

## Convenciones de rutas

- Prefijo único por servicio: `/api/<service>/...`.
- Colecciones: `/api/<service>/resources`.
- Recurso puntual: `/api/<service>/resources/:id`.
- Operaciones específicas: `/api/<service>/resources/:id/<action>`.
- Checks sin side-effect: `GET /api/<service>/checks/...`.

## Convenciones de respuesta

- `GET` de un recurso: devolver el recurso plano.
- `GET` de colección: devolver `{ items }` o una clave semántica estable.
- `DELETE`: devolver `{ ok: true }`.
- Operaciones: devolver el estado actualizado o una estructura corta y explícita.

## Convenciones de error

- Usar un error tipado del servicio.
- Mantener códigos cortos y reutilizables.
- Mensajes breves y orientados a API.

Mapa sugerido:

- `400`: input inválido.
- `401`: token ausente o inválido.
- `403`: permiso insuficiente.
- `404`: recurso no encontrado.
- `409`: conflicto de unicidad o estado.
- `500`: error inesperado.

## Ejemplo mínimo

```ts
@RegisterEndpoint({ method: "POST", url: "/api/my-service/resources", deferAuth: true })
static async create(ctx: EndpointCtx<never, { name?: string }>) {
	if (!ctx.data?.name || typeof ctx.data.name !== "string") {
		throw new MyServiceError(400, "MISSING_FIELDS", "`name` es requerido");
	}

	const service = ResourceEndpoints.#service;
	const caller = await service.resolveCaller(ResourceEndpoints.#kernelKey, ctx);
	const input = { ...ctx.data, name: ctx.data.name.trim() };
	return service.resources.create(input, ctx.token ?? undefined, caller);
}
```

## Checklist de creación

- [ ] Cada grupo de rutas tiene su propio archivo.
- [ ] La clase exportada tiene `init(service, kernelKey)`.
- [ ] La validación del endpoint es sólo de shape y formato.
- [ ] Los campos sensibles del body se descartan antes de delegar.
- [ ] La autorización usa `permissions` o `deferAuth`, no ambos para el mismo caso.
- [ ] El endpoint no toca modelos ni providers.
- [ ] Las respuestas siguen una convención estable.
- [ ] Todos los errores salen mediante el error tipado del servicio.
