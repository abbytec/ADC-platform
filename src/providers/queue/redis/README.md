# Redis Provider

Cliente Redis para caché, sesiones y colas usando ioredis.

## Uso

```typescript
const redis = kernel.getProvider<RedisProvider>("redis");
await redis.set("key", "value", 3600); // TTL 1 hora
const value = await redis.get("key");
```

## Variables de entorno

```
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=
REDIS_DB=0
```
