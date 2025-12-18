# UI Library Utils

## connect-rpc.ts
Cliente genérico para consumir servicios Connect RPC.

```typescript
import { rpcClient } from "@ui-library/utils/connect-rpc";

const response = await rpcClient.call("ServiceName", "MethodName", { /* body */ });
if (response.data) {
  console.log(response.data);
}
```

## router.ts
Router para navegación SPA sin recargar la página.

```typescript
import { router } from "@ui-library/utils/router";

router.navigate("/path");
router.setOnRouteChange((path) => console.log(path));
```
