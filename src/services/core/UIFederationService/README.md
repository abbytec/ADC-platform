# UIFederationService

Build y servido de módulos UI con Module Federation.

## Frameworks soportados
Stencil, React, Vue, Vite, Astro

## Aliases generados
- `@ui-library` → Auto-registra Web Components
- `@ui-library/styles` → CSS base
- `@ui-library/utils/*` → Utilidades de la UI library

## Orden de carga
1. UI Libraries (Stencil) - paralelo
2. Remotes por dependencias - paralelo por nivel
3. Hosts - al final
