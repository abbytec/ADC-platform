# Services Reference

## Core Services (Modo Kernel)

Servicios que se cargan automáticamente con `kernelMode: true`.

### ExecutionManagerService
- Gestión de workers para carga distribuida
- Decorador `@Distributed` para métodos pesados
- Monitoreo de CPU/memoria

### IdentityManagerService
- Gestión de usuarios, roles y grupos
- 8 roles predefinidos: SYSTEM, Admin, Network Manager, Security Manager, Data Manager, App Manager, Config Manager, User
- Hash PBKDF2 (100k iteraciones)
- Fallback a memoria si MongoDB no disponible

### LangManagerService
- Internacionalización (i18n)
- Archivos en `/{app}/i18n/{locale}.js`
- Interpolación `{{param}}`
- Endpoints: `/api/i18n/:namespace`, `/api/i18n?namespaces=...`

### LogManagerService
- Logging centralizado del kernel

### UIFederationService
- Build y servido de módulos UI
- Soporta: Stencil, React, Vue, Vite, Astro
- Module Federation con Rspack
- Namespaces para múltiples UI libraries
- Service Worker dinámico

## Data Services

### Ubicación: `src/services/data/`

Servicios de acceso a datos (CRUD, etc.)

## Crear nuevo Service

```bash
npm run create:service
```

## Configuración de Service

Archivo `config.json` en el directorio del service:

```json
{
  "kernelMode": false,
  "dependencies": []
}
```
