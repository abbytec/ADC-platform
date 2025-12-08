# Task Completion Checklist

## Before Considering a Task Complete

### 1. Run TypeScript Check
```bash
npm run typecheck
```

### 2. Run Linting
```bash
npm run lint
```
Must pass with zero warnings (`--max-warnings 0`).

### 3. Test in Development Mode
```bash
npm run dev
```

## Documentation Updates

When modifying a module:
- Update its `README.md` if behavior changes (max 15 lines)
- `config.json` documents dependencies - update if needed

When adding new modules:
- Create `README.md` in the module directory (ultra-brief)

Architecture changes:
- Update Serena memories for internal details
- Update `CLAUDE.md` only for fundamental concepts
