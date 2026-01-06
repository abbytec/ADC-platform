# ADC UI Library

Web Components (Stencil) para el namespace `adc-platform`.

## Uso
```typescript
import "@ui-library"; // Auto-registra componentes
import "@ui-library/styles"; // CSS base (variables, tipografía)
```

## Componentes
`<adc-button>`, `<adc-text>`, `<adc-site-header>`, `<adc-site-footer>`, etc.

## CSS Variables
Definidas en `src/global/tailwind.css`: `--c-primary`, `--c-accent`, `--c-text`, etc.

## Utils (ver `utils/README.md`)
- `connect-rpc.ts`: Cliente Connect RPC tipado con Protocol Buffers
- `router.ts`: Router SPA para navegación sin recargar página
- `react-jsx.ts`: Declaraciones TypeScript JSX para React
- `tailwind-preset.js`: Preset Tailwind con colores y utilidades ADC
