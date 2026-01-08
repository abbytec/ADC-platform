# Content Service

Servicio de gestión de artículos y rutas de aprendizaje con MongoDB.

## Endpoints (via @RegisterEndpoint)

| Método | Ruta                           | Permisos       | Descripción        |
| ------ | ------------------------------ | -------------- | ------------------ |
| GET    | `/api/learning/paths`          | público        | Lista paths        |
| GET    | `/api/learning/paths/:slug`    | público        | Obtiene path       |
| POST   | `/api/learning/paths`          | content.write  | Crea path          |
| PUT    | `/api/learning/paths/:slug`    | content.write  | Actualiza path     |
| DELETE | `/api/learning/paths/:slug`    | content.delete | Elimina path       |
| GET    | `/api/learning/articles`       | público        | Lista artículos    |
| GET    | `/api/learning/articles/:slug` | público        | Obtiene artículo   |
| POST   | `/api/learning/articles`       | content.write  | Crea artículo      |
| PUT    | `/api/learning/articles/:slug` | content.write  | Actualiza artículo |
| DELETE | `/api/learning/articles/:slug` | content.delete | Elimina artículo   |

Usa `@EnableEndpoints()` y `@DisableEndpoints()` para registro automático via EndpointManagerService.
