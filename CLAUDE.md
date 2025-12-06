# ADC Platform - Context Map

## Project Overview

Kernel modular que carga dinámicamente apps, services, providers y utilities. Soporta versionado semántico, hot reload, y múltiples lenguajes (TS/Python via IPC).

## Structure Map

```
src/
├── index.ts              # Entry point
├── kernel.ts             # Orquestador central (~38K líneas)
├── apps/
│   ├── BaseApp.ts        # Clase base para apps
│   ├── community/        # Apps de la comunidad
│   ├── core/             # Apps del núcleo
│   ├── private/          # Apps privadas
│   └── test/             # Apps de desarrollo/testing
│       ├── 00-web-ui-library/      # UI Components (Stencil)
│       ├── 00-web-ui-library-mobile/
│       ├── web-layout/             # Layout principal (React)
│       ├── web-layout-mobile/
│       ├── web-home/               # Home page
│       ├── web-home-mobile/
│       ├── web-config/             # Configuración UI
│       ├── users-management/       # Gestión usuarios
│       ├── user-profile-file/      # Profile (file storage)
│       └── user-profile-mongo/     # Profile (MongoDB)
├── services/
│   ├── BaseService.ts
│   ├── core/             # Servicios modo kernel
│   │   ├── ExecutionManagerService/  # Workers/distribución
│   │   ├── IdentityManagerService/   # Auth/roles
│   │   ├── LangManagerService/       # i18n
│   │   ├── LogManagerService/        # Logging
│   │   └── UIFederationService/      # Module Federation
│   └── data/             # Servicios de datos
├── providers/
│   ├── BaseProvider.ts
│   ├── files/            # Filesystem
│   ├── http/             # HTTP client
│   └── object/           # Object storage
├── utilities/
│   ├── BaseUtility.ts
│   └── adapters/         # Adaptadores
├── utils/                # Helpers internos
│   ├── decorators/
│   ├── ipc/              # Inter-process communication
│   ├── loaders/          # Module loaders
│   ├── logger/
│   └── react/
└── interfaces/           # TypeScript interfaces
    ├── behaviours/
    ├── interop/
    ├── modules/
    └── utils/
```

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Dev mode (hot reload) |
| `npm run start:prod` | Producción (sin tests) |
| `npm run start:prodtests` | Producción con tests |
| `npm run typecheck` | TypeScript + ts-prune |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint autofix |
| `npm run cleanup` | Limpiar procesos |
| `npm run create:app` | Scaffold nueva app |
| `npm run create:service` | Scaffold nuevo service |
| `npm run create:provider` | Scaffold nuevo provider |
| `npm run create:utility` | Scaffold nueva utility |

## Workflow - Context Economy Protocol

**ANTES de codificar cualquier módulo:**

1. **NO leas todo el código al inicio.** Usa este mapa para orientarte.
2. **Busca documentación local primero:**
   - `{module}/README.md` si existe
   - `{module}/config.json` para dependencias
   - `.claude/parts/*.md` para detalles específicos
3. **Solo lee el código que vas a modificar.**
4. **Para detalles de arquitectura global:** consulta `ARCHITECTURE.md`

**Referencias rápidas:**
- Services: `.claude/parts/services.md`
- Providers: `.claude/parts/providers.md`
- UI System: `.claude/parts/ui-system.md`

## Key Concepts (Quick Reference)

| Concepto | Descripción |
|----------|-------------|
| `kernelMode: true` | Service se carga con el kernel (global) |
| `config.json` | Declara dependencias de una app/service |
| `config-*.json` | Múltiples instancias de una app |
| `@Distributed` | Decorador para ejecutar en worker |
| Namespace UI | Múltiples UI libraries sin colisiones |
| Workspaces | Cada módulo es un npm package aislado |

## Code Style

- **KISS, DRY, SOLID, YAGNI**
- Priorizar legibilidad sobre cleverness
- No documentar lo obvio
- TypeScript strict mode
- ESLint sin warnings (`--max-warnings 0`)
- Un `config.json` por módulo para dependencias

## CLI Tools para búsquedas en el proyecto

Usa la herramienta adecuada según el objetivo:

- **Archivos → `fd`**
- **Texto → `rg`**
- **Patrones/AST → `ast-grep`**
- **JSON → `jq`**
- **YAML → `yq`**

Guías rápidas:

```sh
fd *.tsx              # Buscar archivos
rg "pattern" -t ts    # Buscar texto en TS
ast-grep -p '...'     # Coincidencias por estructura de código
jq '.key' file.json   # Leer valores de JSON
yq '.services' file.yml
```
Si detectás ambigüedad en búsquedas, sugerí fzf para selección interactiva.
Para documentación completa usa .claude/cli-tools.md.


---

## CRITICAL: Self-Maintenance Rule

> **Si durante una tarea modificas la estructura de carpetas, añades un nuevo servicio/app/provider, o cambias una decisión arquitectónica clave, DEBES actualizar este archivo `CLAUDE.md` y/o los archivos en `.claude/parts/` como parte de tus cambios.**

Esta regla es **obligatoria** para mantener la economía de contexto.
