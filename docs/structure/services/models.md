# Models — Plantilla para crear un servicio

Este documento define cómo modelar entidades nuevas con tipos de dominio y schemas Mongoose al arrancar un servicio desde cero.

## Objetivo de la capa

Los models describen persistencia, no casos de uso. El tipo del dominio representa la entidad del sistema; el schema define cómo esa entidad se guarda e indexa.

## Estructura mínima

```text
src/services/<layer>/<MyService>/domain/
├── index.ts
├── resource.ts
└── secondary-resource.ts
```

- Un archivo por entidad persistida.
- `index.ts` re-exporta todos los schemas.
- Los tipos del dominio viven fuera de Mongoose, en `@common/types/<domain>/`.

## Separación entre tipo y schema

Regla base:

- El tipo del dominio no debe depender de Mongoose.
- El schema importa el tipo y lo tipa.
- La lógica de negocio no depende del schema.

Ejemplo:

```ts
import { Schema } from "mongoose";
import type { Resource } from "@common/types/my-service/Resource.ts";

export const resourceSchema = new Schema<Resource>(
	{
		id: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
	},
	{ id: false }
);
```

## Reglas de diseño

- Usar `id` como identificador de dominio.
- No depender de `_id` como clave del negocio.
- Declarar `{ id: false }` para evitar el virtual `id` de Mongoose.
- Usar timestamps manuales si el DAO controla explícitamente `updatedAt`.
- Declarar índices desde el schema, no desde lógica externa.

## Campos comunes

Campos que suelen aparecer en casi todas las entidades:

- `id`.
- `createdAt`.
- `updatedAt`.
- campos parent o tenant si la entidad cuelga de otro contexto.
- campos de estado si el recurso tiene ciclo de vida.

## Índices

Definir índices pensando en lectura real y unicidad.

Casos típicos:

- `id` único.
- índices sobre foreign keys.
- índices sobre campos de búsqueda frecuente.
- índices compuestos para unicidad por tenant.

Ejemplo:

```ts
resourceSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
resourceSchema.index({ parentId: 1 });
```

## Enums y subdocumentos

- Enums simples pueden ir inline en el schema.
- Subdocumentos pequeños y exclusivos del recurso también pueden ir inline.
- Si una estructura se reutiliza en varias entidades, convertirla en tipo compartido.
- Para campos flexibles, usar `Schema.Types.Mixed` sólo cuando la forma no sea estable.

## Multi-tenant

Antes de modelar, decidir cuál de estos enfoques aplica:

### 1. Partición por campo

La entidad vive en una colección compartida y lleva `tenantId`, `orgId` o equivalente.

- Agregar el campo al schema.
- Indexarlo.
- Incluirlo en índices únicos compuestos.

### 2. Partición por base o conexión

La entidad vive en una base o conexión separada por tenant.

- No agregar campo tenant si ya viene implícito por conexión.
- Resolver el model en el contexto del tenant.

## Qué valida el schema

Validaciones que sí van en el schema:

- `required`.
- tipo.
- `enum`.
- `default`.
- índices y unicidad.

Validaciones que no van en el schema:

- reglas de negocio entre campos.
- permisos.
- límites por plan o cuota.
- ownership y mutabilidad.

## Relación con la DAO

El schema no debería decidir qué campos son mutables. Esa regla vive en la DAO.

Campos típicamente inmutables:

- `id`.
- `createdAt`.
- claves parent o tenant.
- ownership.
- claves derivadas o contadores.

## Creación del model en el servicio

El servicio crea los models en `start()` usando el provider correspondiente.

```ts
const ResourceModel = this.mongoProvider.createModel<Resource>("resources", resourceSchema);
```

Reglas:

- Nombre de colección en plural y minúscula.
- El servicio es dueño de la creación del model.
- No instanciar models dispersos en varios archivos.

## Checklist de creación

- [ ] El tipo del dominio está en `@common/types/<domain>/`.
- [ ] Cada entidad persistida tiene su archivo en `domain/`.
- [ ] El schema usa `id` como clave de dominio.
- [ ] `createdAt` y `updatedAt` están definidos explícitamente.
- [ ] Los índices reflejan queries reales y unicidad necesaria.
- [ ] La estrategia multi-tenant está resuelta antes de crear índices.
- [ ] `domain/index.ts` re-exporta todos los schemas.
- [ ] Los models se crean en `Service.start()`.
