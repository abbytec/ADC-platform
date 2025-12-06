# UI System Reference

## UI Libraries (Stencil Web Components)

### 00-web-ui-library

-   Componentes desktop: `<adc-button>`, `<adc-header>`, `<adc-container>`, `<adc-stat-card>`
-   Framework-agnostic (Web Components)

### 00-web-ui-library-mobile

-   Componentes móviles

## Uso

```typescript
import '@ui-library/loader';

// JSX
<adc-button onAdcClick={handleClick}>Click</adc-button>

// HTML
<adc-button>Click</adc-button>
```

## UIFederationService Config

```json
{
	"uiModule": {
		"name": "layout",
		"uiNamespace": "default",
		"framework": "react",
		"devPort": 3014,
		"serviceWorker": true,
		"i18n": true
	}
}
```

## Namespaces

-   Permiten múltiples UI libraries sin colisiones
-   Cada namespace tiene su import map: `/:namespace/importmap.json`
-   `default` se usa cuando no se especifica

## i18n

Archivos en `/{app}/i18n/{locale}.js`:

```javascript
export default {
	title: "Estadísticas",
	welcome: "Bienvenido, {{name}}",
};
```

Cliente:

```javascript
t("welcome", { name: "Juan" });
setLocale("es");
getLocale();
```

## Endpoints

-   `GET /api/ui/namespaces`
-   `GET /:namespace/importmap.json`
-   `GET /api/i18n/:namespace?locale=es`
