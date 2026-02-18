# UI Library Utils

## connect-rpc.ts

Cliente Connect RPC tipado usando Protocol Buffers.

```typescript
import { learningClient, type LearningPath } from "@ui-library/utils/connect-rpc";

// Listar paths
const { paths } = await learningClient.listPaths({ listed: true });

// Obtener artículo
const { article } = await learningClient.getArticle({ slug: "mi-articulo" });
```

## router.ts

Router para navegación SPA sin recargar la página. Ubicado en `@common/utils/router.js`.

```typescript
import { router } from "@common/utils/router.js";

router.navigate("/path");
router.setOnRouteChange((path) => console.log(path));
```
