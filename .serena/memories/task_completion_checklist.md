# Task Completion Checklist

## Before Considering a Task Complete

### 1. Run TypeScript Check

```bash
npm run typecheck
```

This runs TypeScript compiler + ts-prune for dead code detection.

### 2. Run Linting

```bash
npm run lint
```

Must pass with zero warnings (`--max-warnings 0`).

### 3. Fix Linting Issues (if any)

```bash
npm run lint:fix
```

### 4. Test in Development Mode

```bash
npm run dev
```

Verify hot reload works and no runtime errors.

### 5. Test in Production Mode (if applicable)

```bash
npm run start:prodtests
```

Verify production build works correctly.

## Critical Documentation Rule

From CLAUDE.md:

> **Si durante una tarea modificas la estructura de carpetas, añades un nuevo servicio/app/provider, o cambias una decisión arquitectónica clave, DEBES actualizar el archivo `CLAUDE.md` y/o los archivos en `.claude/parts/` como parte de tus cambios.**

## What to Update When

-   New app/service/provider/utility → Update relevant `.claude/parts/*.md`
-   Architecture changes → Update `ARCHITECTURE.md`
-   New commands → Update `CLAUDE.md` Commands table
-   New concepts → Update `CLAUDE.md` Key Concepts table
