# Content Service

Servicio de gestión de artículos y rutas de aprendizaje con MongoDB.

## Configuración

MongoDB se configura desde la app que usa el servicio (ej: community-home).
El servicio solo declara sus dependencias de providers.

## Endpoints REST (estilo RPC)

Prefijo: `POST /api/rpc/ContentService/`

### Learning Paths
- `ListPaths` - Lista paths (body: { published?, limit?, skip? })
- `GetPath` - Obtiene path (body: { slug })
- `CreatePath`, `UpdatePath`, `DeletePath` - CRUD operations

### Articles
- `ListArticles` - Lista artículos (body: { published?, tags?, limit?, skip? })
- `GetArticle` - Obtiene artículo (body: { slug })
- `CreateArticle`, `UpdateArticle`, `DeleteArticle` - CRUD operations
