# Arquitectura de ADC Platform

## Componentes

### Kernel
Orquestador central que carga dinámicamente componentes del filesystem. Busca recursivamente providers, middlewares y presets en sus directorios. Registra capacidades mediante Symbols para inyección de dependencias. También ejecuta las Apps.

### Providers (Capa I/O)
Sistemas de almacenamiento, conexiones a bases de datos, APIs externas. Ubicados en `src/providers/`.

### Middlewares (Capa Lógica)
Serializadores, validadores, filtros, transformadores. Ubicados en `src/middlewares/`.

### Presets (Capa Utilidad)
Funcionalidad reutilizable sin lógica de ejecución automática. Pueden ser stateful. Ubicados en `src/presets/`. Pueden tener su propio `modules.json` para cargar dependencias.

### Apps (Capa Negocio)
Lógica principal que consume Providers, Middlewares y Presets. Se ejecutan automáticamente. Ubicados en `src/apps/`. Cada app puede tener un `modules.json` para declarar sus módulos específicos.

### Instancias Múltiples de Apps

Es posible crear múltiples instancias de una misma aplicación proporcionando diferentes archivos de configuración. El Kernel buscará archivos de configuración en dos ubicaciones dentro del directorio de una aplicación:

1.  **Directorio Raíz de la App**: Archivos `config.json` o `config-*.json` en la raíz del directorio de la app.
2.  **Directorio `configs`**: Archivos `config.json` o `config-*.json` dentro de un subdirectorio llamado `configs`.

Por cada archivo de configuración encontrado, el Kernel creará una nueva instancia de la aplicación. El nombre de la instancia se generará combinando el nombre de la aplicación y el nombre del archivo de configuración (sin la extensión `.json`).

Por ejemplo, para una aplicación llamada `user-profile`, la siguiente estructura de archivos creará tres instancias:

```
src/apps/user-profile/
├── index.ts
├── config-main.json
└── configs/
    ├── config-web.json
    └── config-api.json
```

Las instancias creadas serán:

-   `user-profile:config-main`
-   `user-profile:config-web`
-   `user-profile:config-api`

Cada instancia recibirá su propia configuración y se ejecutará de forma independiente. Esto permite, por ejemplo, tener la misma lógica de aplicación conectada a diferentes bases de datos o con diferentes parámetros de funcionamiento.

### Configuración de Módulos por Instancia

Los archivos de configuración de instancia (e.g., `config-main.json`) también pueden contener una sección `modules`. Esta sección sigue la misma estructura que un archivo `modules.json`, permitiendo definir dependencias y configuraciones de módulos específicas para cada instancia de la aplicación.

### Loaders (Sistema Modular)
Sistema de carga de módulos con soporte para versionado semántico y múltiples lenguajes. Ubicados en `src/loaders/`.

## Flujo de Carga

```
1. Kernel.start()
   ├─ 2. Cargar Providers (recursivo, fallback global)
   ├─ 3. Cargar Middlewares (recursivo, fallback global)
   ├─ 4. Cargar Presets (recursivo, fallback global)
   │
   └─ 5. Cargar Apps (cada app)
      └─ App.loadModulesFromConfig()
         ├─ Lee modules.json en el directorio de la app
         ├─ Para cada módulo declarado:
         │  ├─ VersionResolver resuelve versión compatible
         │  ├─ LoaderManager selecciona loader por lenguaje
         │  ├─ Loader importa el módulo
         │  └─ Kernel registra el módulo
         ├─ App.start()
         └─ App.run()
```

## Sistema de Capacidades

Cada componente registra una capacidad (Symbol único) que otros pueden consumir:

```typescript
const storage = kernel.getProvider(STORAGE_PROVIDER);
```

## Búsqueda Recursiva

El Kernel busca recursivamente sin límites de profundidad en sus directorios (`providers/`, `middlewares/`, `presets/`, `apps/`).

## Hot Reloading

En desarrollo (`NODE_ENV=development`) el Kernel observa cambios y recarga componentes automáticamente.

## Sistema de Versionado

El sistema soporta versionado semántico con el patrón: `{moduleName}/{version}-{language}/`

### Estructura de Módulos

```
src/presets/
├── JsonFileCrud/
│   ├── index.ts                    # Versión default (1.0.0)
│   └── modules.json                # (Opcional) Dependencias del preset
├── JsonFileCrud/1.0.1-ts/
│   └── index.ts                    # Versión específica TypeScript
├── JsonFileCrud/2.0.0-ts/
│   └── index.ts                    # Versión major
└── JsonFileCrud/1.0.0-py/
    └── index.py                    # Versión en Python
```

### Especificadores de Versión

Soportados: `1.0.0` (exacta), `^1.0.0` (caret), `~1.2.3` (tilde), `>=1.0.0`, `>1.0.0`, `<=2.0.0`, `<2.0.0`, `*`/`latest`

### Declarar en modules.json (Apps)

```json
{
  "failOnError": false,
  "presets": [
    {
      "name": "JsonFileCrud",
      "version": "^1.0.0",
      "language": "typescript",
      "config": {}
    }
  ]
}
```

## Distribución de Responsabilidades

### Kernel
- Carga recursiva de `providers/`, `middlewares/`, `presets/` (fallback global)
- Ejecuta Apps encontradas
- Registra módulos en el registry central
- Soporta hot reloading en desarrollo

### BaseApp
- Responsable de cargar sus propios módulos desde `modules.json`
- Obtiene módulos del kernel después de cargarlos
- Ejecuta lógica de negocio en `run()`
- NO declara dependencias estáticas

### ModuleLoader
- Resuelve versiones según especificadores semver
- Selecciona loader por lenguaje
- Carga dinámicamente módulos versionados
- Pasa configuración al módulo

## Optimizaciones de Memoria

- Cada app carga solo los módulos que declara en `modules.json`
- El Kernel mantiene un fallback global para módulos sin versionar
- Menor impacto en memoria en ejecuciones con múltiples apps
