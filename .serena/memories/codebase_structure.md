# Codebase Structure

## Root Files
- `src/index.ts` - Entry point
- `src/kernel.ts` - Central orchestrator (~38K lines)
- `CLAUDE.md` - Context map for AI assistants
- `ARCHITECTURE.md` - Detailed architecture documentation

## Main Directories

### `src/apps/`
Business logic layer. Auto-executed by kernel.
- `core/` - Core apps
- `community/` - Community apps
- `private/` - Private apps
- `test/` - Development/testing apps

#### Notable Test Apps
- `00-web-ui-library/` - Stencil Web Components (desktop)
- `00-web-ui-library-mobile/` - Stencil Web Components (mobile)
- `web-layout/` - Main React layout
- `web-layout-mobile/` - Mobile React layout
- `web-home/` - Home page
- `web-config/` - Configuration UI
- `users-management/` - User management
- `user-profile-file/` - Profile (file storage)
- `user-profile-mongo/` - Profile (MongoDB)

### `src/services/`
Reusable functionality. Can be stateful.
- `core/` - Kernel-mode services
  - `ExecutionManagerService/` - Workers/distribution
  - `IdentityManagerService/` - Auth/roles
  - `LangManagerService/` - i18n
  - `LogManagerService/` - Logging
  - `UIFederationService/` - Module Federation
- `data/` - Data services

### `src/providers/`
I/O layer.
- `files/` - Filesystem access
- `http/` - HTTP servers
  - `express-server/` - Express (development)
  - `fastify-server/` - Fastify + host routing (production)
- `object/` - Object storage

### `src/utilities/`
Logic layer (serializers, validators, filters, transformers).
- `adapters/` - Adapters

### `src/utils/`
Internal helpers.
- `decorators/` - TypeScript decorators
- `ipc/` - Inter-process communication
- `loaders/` - Module loaders
- `logger/` - Logging utilities
- `react/` - React utilities

### `src/interfaces/`
TypeScript interfaces.
- `behaviours/`
- `interop/`
- `modules/`
- `utils/`

## Configuration Files Pattern
- `config.json` - Default instance config
- `config-*.json` - Named instance configs
- `configs/config-*.json` - Additional instance configs

## Documentation
- `CLAUDE.md` - Quick reference context map
- `ARCHITECTURE.md` - Detailed architecture
- `.claude/parts/services.md` - Services reference
- `.claude/parts/providers.md` - Providers reference
- `.claude/parts/ui-system.md` - UI system reference
