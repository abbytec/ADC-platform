# Arquitectura de ADC Platform

## Componentes

### Kernel
Orquestador central que carga dinámicamente todos los componentes desde `src/` (o `dist/` en producción). Registra capacidades mediante Symbols para inyección de dependencias.

### Providers (Capa I/O)
Sistemas de almacenamiento, conexiones a bases de datos, APIs externas. Ubicados en `src/providers/`.

### Middlewares (Capa Lógica)
Serializadores, validadores, filtros, transformadores. Ubicados en `src/middlewares/`.

### Presets (Capa Utilidad)
Funcionalidad reutilizable sin lógica de ejecución automática. Pueden ser stateful. Ubicados en `src/presets/`.

### Apps (Capa Negocio)
Lógica principal que consume Providers, Middlewares y Presets. Se ejecutan automáticamente. Ubicados en `src/apps/`.

## Flujo de Carga

1. Kernel.start()
2. Cargar Providers
3. Cargar Middlewares
4. Cargar Presets
5. Cargar Apps (validan dependencias y ejecutan)

## Sistema de Capacidades

Cada componente registra una capacidad (Symbol único) que otros pueden consumir:

```typescript
const storage = kernel.get(STORAGE_CAPABILITY);
```

## Inyección de Dependencias

Las Apps declaran sus dependencias:

```typescript
export default class MyApp extends BaseApp {
  protected requiredProviders = [STORAGE_CAPABILITY];
  protected requiredMiddlewares = [JSON_ADAPTER_CAPABILITY];
  protected requiredPresets = [SOME_PRESET_CAPABILITY];
}
```

## Búsqueda Recursiva

Todos los componentes se buscan recursivamente sin límites de profundidad en sus directorios.

## Hot Reloading

En desarrollo (`NODE_ENV=development`) el Kernel observa cambios y recarga componentes automáticamente.
