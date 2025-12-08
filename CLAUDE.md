# ADC Platform

Kernel modular con carga dinámica de apps, services, providers y utilities.
Utilizar patrones KISS, DRY, SOLID y YAGNI.

## Estructura

```
src/
├── kernel.ts          # Orquestador central
├── apps/              # Aplicaciones (cada una con README.md)
│   ├── public/        # Apps públicas (adc-platform namespace)
│   └── test/          # Apps de desarrollo (default namespace)
├── services/core/     # Servicios kernel (cada uno con README.md)
├── providers/         # Proveedores (cada uno con README.md)
└── utils/             # Helpers internos
```

## Commands

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Desarrollo (hot reload)        |
| `npm run start:prodtests` | Simular producción + tests habilitados |
| `npm run start`   | Producción (puerto 80)         |
| `npm run typecheck` | TypeScript check             |
| `npm run lint`    | ESLint                         |
| `npm run cleanup`         | Limpiar procesos                       |

## Key Concepts

| Concepto | Descripción |
| -------- | ----------- |
| `config.json` | Dependencias y configuración del módulo |
| `uiDependencies` | Apps UI que deben cargarse antes |
| `@ui-library` | Auto-registra Web Components al importarse |
| `@ui-library/styles` | CSS base de la UI Library |
| `uiNamespace` | Aísla UI libraries (ej: `adc-platform`, `default`) |
| `@Distributed`     | Decorador para ejecutar en worker              |

**Configuración de hosting en `config.json`:**

```json
{
	"uiModule": {
		"hosting": {
			"hosts": [{ "domain": "local.com", "subdomains": ["cloud", "users", "*"] }]
		}
	}
}

## UI Apps

```typescript
// main.tsx - Patrón de imports
import "@ui-library"; // Auto-registra Web Components
import "@ui-library/styles"; // CSS base (variables, tipografía, etc.)
import "./styles/tailwind.css"; // Extensiones locales (solo Tailwind + extensiones propias)
```

## Documentation Rules

- Cada módulo tiene su propio `README.md` (máx 15 líneas)
- `config.json` documenta dependencias
- NO crear documentación centralizada redundante ni documentar lo obvio
- Al modificar un módulo, actualizar SU readme si es necesario
