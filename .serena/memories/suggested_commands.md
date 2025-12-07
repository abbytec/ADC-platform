# Suggested Commands

## Development

```bash
npm run dev          # Development mode with hot reload (port 3000)
```

## Production

```bash
npm run start              # Production mode (port 80, no test apps)
npm run start:prodtests    # Production simulation with tests (port 3000)
```

## Code Quality

```bash
npm run typecheck          # TypeScript checking + ts-prune for dead code
npm run lint               # ESLint (no warnings allowed: --max-warnings 0)
npm run lint:fix           # ESLint with auto-fix
```

## Scaffolding

```bash
npm run create:app         # Create new app
npm run create:service     # Create new service
npm run create:provider    # Create new provider
npm run create:utility     # Create new utility
```

## Utilities

```bash
npm run cleanup            # Kill stale processes
```

## Workspace Dependencies

```bash
# Add dependency to specific module
npm install <package> -w @adc-platform/<module-name>
```

## System Commands (Linux)

-   `git` - Version control
-   `ls`, `cd` - Directory navigation
-   `grep`, `find` - Search utilities
-   `docker`, `docker-compose` - Container management
