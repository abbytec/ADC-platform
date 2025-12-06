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
│   ├── http/             # HTTP servers
│   │   ├── express-server/   # Express (desarrollo)
│   │   └── fastify-server/   # Fastify + host routing (producción)
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
| `npm run start` | Producción (sin tests) |
| `npm start:dev` | Dev mode (hot reload) |
| `npm run start:prodtests` | Simular producción + tests habilitados |
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
| `hosting` | Config de dominios/subdominios para producción |

## Production Hosting

En producción, las apps UI se sirven mediante **virtual hosts** (dominios/subdominios).

**Providers HTTP:**
- `express-server`: usado en desarrollo (`npm run start:dev`)
- `fastify-server`: usado en producción con host-based routing

**Puertos:**
- `npm run start` → puerto 80 (producción real)
- `npm run start:prodtests` → puerto 3000 (tests de producción)
- `npm run start:dev` → puerto 3000 + dev servers en puertos separados

**Configuración de hosting en `config.json`:**
```json
{
  "uiModule": {
    "hosting": {
      "hosts": [{ "domain": "local.com", "subdomains": ["cloud", "users", "*"] }]
    }
  }
}
```

## Code Style

- **KISS, DRY, SOLID, YAGNI**
- Priorizar legibilidad sobre cleverness
- No documentar lo obvio
- TypeScript strict mode
- ESLint sin warnings (`--max-warnings 0`)
- Un `config.json` por módulo para dependencias

## CLI Tools para búsquedas en el proyecto

Si necesitas buscar algo, usa la herramienta adecuada (evita herramientas genéricas como `find`/`grep` salvo casos especiales).

| Objetivo | Herramienta recomendada | Binario original | Reemplaza o mejora frente a | Cuándo usarla |
|---|---|---|---|---|
| Buscar **archivos** por nombre/extensión | `fd` | `fdfind` (Debian/Ubuntu) | `find` | "¿Dónde está este archivo?" |
| Buscar **texto** dentro de archivos | `rg` | `ripgrep` | `grep`, `ag` | "¿Dónde aparece este string?" |
| Buscar **estructura de código (AST)** | `ast-grep` | `ast-grep` | `grep/rg` cuando fallan por texto | "Encontrar patrones de código, no solo texto" |
| Filtrar resultados de forma interactiva | `fzf` | `fzf` | `select`, `fzf` UI sobre cualquier lista | "Elegir entre muchos resultados" |
| Leer/filtrar **JSON** | `jq` | `jq` | `grep + sed + cat` sobre json | "Necesito un valor de package.json" |
| Leer/filtrar **YAML** | `yq` | `yq` | `grep + sed + cat` sobre yaml | "Necesito algo de compose.yml" |

### Guías rápidas (con casos prácticos frecuentes):

# Buscar ARCHIVOS (mejor que find)
fd "*.tsx"                   # Archivos TSX en el repo
fd config --type f           # Archivos con 'config' en el nombre
fd -e ts -e tsx              # Extensiones específicas

# Buscar TEXTO (mejor que grep/ack/ag)
rg "TODO" -t ts              # Solo TypeScript
rg "useEffect" -g "*.tsx"    # En componentes UI
rg "apiKey" -l               # Mostrar solo archivos que contienen el texto

# Buscar PATRONES DE CÓDIGO (AST-aware)
ast-grep -p 'async function $NAME($_)' -l ts    # Funciones async
ast-grep -p 'useEffect($FN, [])' -l tsx         # useEffect sin deps
ast-grep -p 'class $N extends BaseApp'          # Herencias específicas

# Selección INTERACTIVA
fd src | fzf                 # Buscar archivo y seleccionar para abrir
rg "hook" | fzf              # Elegir resultado entre muchos

# JSON
jq '.dependencies' package.json         # Ver dependencias
jq '.scripts | keys' package.json       # Listar scripts

# YAML
yq '.services' docker-compose.yml       # Listar servicios
yq '.services.api.image' file.yml       # Extraer valores

Para documentación completa usa .claude/cli-tools.md.


---

## CRITICAL: Self-Maintenance Rule

> **Si durante una tarea modificas la estructura de carpetas, añades un nuevo servicio/app/provider, o cambias una decisión arquitectónica clave, DEBES actualizar este archivo `CLAUDE.md` y/o los archivos en `.claude/parts/` como parte de tus cambios.**

Esta regla es **obligatoria** para mantener la economía de contexto.
