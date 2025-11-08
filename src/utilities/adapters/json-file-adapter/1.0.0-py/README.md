# JSON File Adapter - Python Implementation

Implementación en Python del adaptador JSON para ADC Platform.

## Descripción

Este utility proporciona funcionalidad para convertir datos entre objetos Python y buffers (bytes) en formato JSON. Es compatible con el sistema de interoperabilidad de ADC Platform y puede ser llamado desde módulos TypeScript mediante IPC.

## Uso

### Configuración en modules.json

```json
{
  "utilities": [
    {
      "name": "json-file-adapter",
      "version": "1.0.0-py",
      "language": "python"
    }
  ]
}
```

### Desde TypeScript

```typescript
// El kernel automáticamente carga el módulo Python
const adapter = await kernel.getUtility("json-file-adapter");
const instance = await adapter.getInstance();

// Convertir datos a buffer (llamada via IPC)
const data = { name: "John", age: 30 };
const buffer = await instance.to_buffer(data);

// Convertir buffer a datos (llamada via IPC)
const result = await instance.from_buffer(buffer);
console.log(result); // { name: "John", age: 30 }
```

## Métodos

### `to_buffer(data: Any) -> bytes`

Convierte datos Python (cualquier objeto serializable a JSON) en un buffer de bytes UTF-8.

**Parámetros:**
- `data`: Los datos a serializar

**Retorna:**
- `bytes`: Los datos serializados como bytes

### `from_buffer(buffer: bytes) -> Any`

Convierte un buffer de bytes UTF-8 en datos Python parseando JSON.

**Parámetros:**
- `buffer`: Los bytes en formato JSON UTF-8

**Retorna:**
- `Any`: Los datos deserializados

**Errores:**
- `ValueError`: Si el buffer está vacío o no es JSON válido

## Requisitos

- Python 3.7+
- No requiere dependencias externas

## Desarrollo

### Ejecutar directamente

```bash
export ADC_MODULE_NAME=json-file-adapter
export ADC_MODULE_VERSION=1.0.0-py
export ADC_MODULE_TYPE=utility
export ADC_MODULE_CONFIG='{}'
export PYTHONPATH=/ruta/a/interfaces/interop/py

python3 index.py
```

### Testing

El módulo se inicia como servidor IPC y espera conexiones. Para testear, usa el sistema de módulos de ADC Platform.

## Notas

- El módulo escribe logs a stderr para no interferir con stdout
- La comunicación IPC usa newline-delimited JSON
- Los timeouts de llamadas IPC son de 30 segundos

