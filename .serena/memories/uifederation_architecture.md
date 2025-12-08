# UIFederationService Architecture

## Core Components

### 1. Module Loading (kernel.ts)
- `#buildAppLoadQueue()`: Orders apps by dependencies using `uiDependencies` from config.json
- UI libraries (Stencil) are detected by `framework === "stencil" && exports` and loaded first
- Apps wait for their dependencies before being added to the queue
- **Current Issue**: Loading is sequential, not parallel

### 2. UIFederationService (index.ts)
- Manages UI module registration, building, and serving
- Uses namespace-based organization: `Map<namespace, Map<moduleName, module>>`
- Supports both development (Express) and production (Fastify with host-based routing)
- Key methods:
  - `registerUIModule()`: Registers and builds a UI module
  - `#waitForUILibraryBuild()`: Waits for Stencil UI library before building other modules
  - `#regenerateLayoutConfigsForNamespace()`: Restarts host dev servers when new remotes register

### 3. Build Strategies
- **Stencil (stencil-strategy.ts)**: Web components, outputs loader + custom-elements
- **Rspack (rspack/base.ts)**: React/Vue with Module Federation
- **Vite (vite/base.ts)**: React/Vue with import maps

### 4. Module Federation (Rspack)
- `detectRemotes()`: Scans registered modules for remotes (non-layout, with devPort, same namespace)
- Hosts get `remotes: {...}` config pointing to remote mf-manifest.json URLs
- Remotes expose `./App` component

## Key Concepts

### uiDependencies
Array in config.json that declares which modules must load before this one:
```json
{
  "uiModule": {
    "uiDependencies": ["home", "web-ui-library"]
  }
}
```

### Namespace Isolation
Modules in different namespaces are isolated:
- `uiNamespace: "default"` (implicit if not set)
- `uiNamespace: "adc-platform"` (explicit)

### Host vs Remote
- `isHost: true`: Main app that loads remotes
- `isRemote: true`: Module exposed via Module Federation

## Auto-Init System (2025-12)

### How it works
1. `stencil-strategy.ts` generates `init.js` + `styles.css` in output dir
2. `init.js` auto-executes `defineCustomElements(window)` on import
3. `alias-generator.ts` maps:
   - `@ui-library` → `init.js` (auto-registers components)
   - `@ui-library/styles` → `styles.css` (CSS base)
   - `@ui-library/utils/*` → utilities from source

### Usage in apps
```typescript
import "@ui-library";        // Auto-registers Web Components
import "@ui-library/styles"; // Loads CSS base
```

## Load Order
1. **Level 0**: UI Libraries (Stencil) - parallel
2. **Level 1+**: Apps by dependency level - parallel within level
3. **Last Level**: Hosts - after all remotes

## Documentation Pattern
- Each module has its own `README.md` (max 15 lines)
- `config.json` documents dependencies
- NO centralized redundant docs
- Serena memories for architecture internals