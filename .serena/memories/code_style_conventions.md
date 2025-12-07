# Code Style & Conventions

## Principles
- **KISS** - Keep It Simple, Stupid
- **DRY** - Don't Repeat Yourself
- **SOLID** - Single responsibility, Open/closed, etc.
- **YAGNI** - You Aren't Gonna Need It

## TypeScript Configuration
- Strict mode enabled
- Target: ES2022
- Module: NodeNext
- Decorators enabled (`experimentalDecorators: true`)
- No unused locals/parameters allowed
- No unreachable code allowed

## Formatting (Prettier)
```json
{
  "printWidth": 145,
  "tabWidth": 4,
  "useTabs": true,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5"
}
```

## ESLint
- Uses typescript-eslint
- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-unused-vars`: off
- Zero warnings policy (`--max-warnings 0`)

## Naming Conventions
- Files: kebab-case for most files
- Classes: PascalCase (e.g., `BaseApp`, `ExecutionManagerService`)
- Variables/Functions: camelCase
- Constants: UPPER_SNAKE_CASE for symbols/capabilities

## Module Structure
- Each module is an npm workspace package
- Each module can have its own `package.json` (not required)
- Dependencies declared in module's `config.json`
- One `config.json` per module for kernel dependencies

## Documentation
- Prioritize readability over cleverness
- Don't document the obvious
- Use `CLAUDE.md` and `.claude/parts/*.md` for architecture docs
- Update docs when changing structure

## Key Patterns
- `@Distributed` decorator for heavy computations
- `kernelMode: true` in config.json for global services
- Symbol-based capability registration
- Semantic versioning for modules: `{name}/{version}-{language}/`
