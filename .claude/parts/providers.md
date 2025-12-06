# Providers Reference

## Categorías

### Files (`src/providers/files/`)
- Acceso a filesystem
- Lectura/escritura de archivos

### HTTP (`src/providers/http/`)
- Cliente HTTP
- APIs externas

### Object (`src/providers/object/`)
- Almacenamiento de objetos
- Serialización

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
