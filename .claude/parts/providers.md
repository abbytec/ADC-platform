# Providers Reference

## Categorías

### Files (`src/providers/files/`)

-   Acceso a filesystem
-   Lectura/escritura de archivos

### HTTP (`src/providers/http/`)

-   **express-server**: Servidor HTTP Express (usado en desarrollo)
-   **fastify-server**: Servidor HTTP Fastify con host-based routing (usado en producción)

### Object (`src/providers/object/`)

-   Almacenamiento de objetos
-   Serialización

## HTTP Providers

### express-server

Servidor Express tradicional. Usado automáticamente en modo desarrollo (`npm run dev`).

### fastify-server

Servidor Fastify con soporte para virtual hosts. Usado automáticamente en producción (`npm run start` y `npm run start:prodtests`).

**Características:**

-   Host-based routing (subdominios y dominios)
-   Mayor rendimiento que Express
-   Prioridad automática (hosts específicos > comodines)
-   SPA fallback integrado

**Puertos:**

-   `npm run start` → puerto 80
-   `npm run start:prodtests` → puerto 3000
-   `npm run dev` → puerto 3000 (con dev servers en puertos separados)

## Crear nuevo Provider

```bash
npm run create:provider
```

## Uso en Apps

Declarar en `config.json`:

```json
{
	"providers": [
		{
			"name": "mongo",
			"global": true,
			"custom": {
				"uri": "mongodb://..."
			}
		}
	]
}
```

## Obtener en código

```typescript
const storage = kernel.getProvider(STORAGE_PROVIDER);
```
