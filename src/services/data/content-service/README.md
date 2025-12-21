# Content Service

Servicio de gestión de artículos y rutas de aprendizaje con MongoDB.

## Connect RPC

Usa Protocol Buffers para definir el API tipado. Proto en `src/common/ADC/proto/learning/`.

```bash
npm run proto:gen  # Regenerar tipos TypeScript
```

## Servicio: LearningService

### Paths
- `ListPaths` - Lista paths (filtros: public, listed, limit, skip)
- `GetPath` - Obtiene path por slug
- `CreatePath`, `UpdatePath`, `DeletePath` - CRUD

### Articles
- `ListArticles` - Lista artículos (filtros: listed, pathSlug, q, limit, skip)
- `GetArticle` - Obtiene artículo por slug
- `CreateArticle`, `UpdateArticle`, `DeleteArticle` - CRUD
