# LogManagerService

Servicio centralizado para gestionar logs de aplicación, incluyendo logging automático de requests HTTP con persistencia en MongoDB.

## Características

- **Logging de Requests HTTP**: Captura automáticamente todas las requests/responses HTTP
- **Clasificación de Status**: Diferencia entre `success`, `refused` (errores controlados) y `failed` (errores inesperados)
- **Persistencia en MongoDB**: Almacena logs en colección `http_logs` con indexación para queries rápidas
- **Non-Blocking**: El logging NO bloquea la respuesta HTTP (fire-and-forget)
- **Limpieza Automática**: Elimina logs antiguos por edad o cantidad
- **Estadísticas**: Proporciona stats de logs HTTP por status y endpoint

## Métodos

### `logHttpRequest(request: HttpRequestLog): Promise<void>`

Registra un request HTTP de forma asíncrona sin bloquear.

**Parámetros:**
- `endpoint` (string): URL del endpoint (ej: `/api/users/profile`)
- `method` (string): Método HTTP (GET, POST, PUT, PATCH, DELETE)
- `statusCode` (number): Status HTTP de la respuesta
- `error?` (Error): Error lanzado (opcional)

**Lógica de Status:**
- **"success"**: POST/PUT/PATCH/DELETE sin error (GET requests se ignoran)
- **"refused"**: `HttpError` o `AuthError` (errores controlados)
- **"failed"**: Otros errores (status 500)
- **Sin logging**: GET requests sin error (no se loguean)

**Ejemplo:**
```typescript
const logManager = kernel.getService("LogManagerService");
logManager.logHttpRequest({
  endpoint: "/api/users",
  method: "POST",
  statusCode: 201
});
```

### `getHttpLogStats(): Promise<{ total: number; byStatus; byEndpoint }>`

Obtiene estadísticas de logs HTTP.

**Retorna:**
```typescript
{
  total: 1234,                    // Total de requests loguedos
  byStatus: {                     // Agrupado por status
    success: 800,
    refused: 200,
    failed: 234
  },
  byEndpoint: {                   // Top 20 endpoints
    "/api/users": 500,
    "/api/posts": 350,
    ...
  }
}
```

## Indexes

Se crean automáticamente en MongoDB:
- `endpoint` (single): Para filtrar por endpoint
- `status` (single): Para filtrar por status
- `timestamp` (single, descending): Para ordenar por fecha
- `(endpoint, status, timestamp)` (compound): Para queries complejas

## Non-Blocking Behavior

El logging es **fire-and-forget** para no impactar latencia HTTP:

```typescript
// En http.ts - se ejecuta sin await
logMgr?.logHttpRequest({ ... });  // Returns immediately
```

Si MongoDB falla, el error se silencia en logs de debug (no bloquea).

## Integración

**Automática en EndpointManagerService:**
- Cada request HTTP llama automáticamente a `logHttpRequest`
- Se loguean:
  - ✓ Requests exitosos (mutaciones sin error)
  - ✓ Errores controlados (HttpError, AuthError)
  - ✓ Errores inesperados (status 500)
  - ✗ GET requests sin error (ignorados)

**Configuración en `config.json`:**
```json
{
  "kernelMode": true,
  "custom": {
    "retentionDays": 3,
    "retentionCount": 10,
    "logsDir": "temp/logs"
  },
  "providers": [
    { "name": "object/mongo", "global": true }
  ]
}
```

## Limpieza Automática

Se ejecuta diariamente y elimina logs antiguos por:
1. **Edad**: Logs más antiguos que `retentionDays`
2. **Cantidad**: Mantiene solo los últimos `retentionCount` archivos
3. **MongoDB**: Elimina documentos con timestamp más antiguo que `retentionDays`
