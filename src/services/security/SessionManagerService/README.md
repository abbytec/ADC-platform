# SessionManagerService

Gestión de autenticación OAuth 2.0 y sesiones JWT.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/auth/login/:provider` | Inicia login OAuth |
| GET | `/api/auth/callback/:provider` | Callback del provider |
| GET | `/api/auth/session` | Verifica sesión activa |
| POST | `/api/auth/logout` | Cierra sesión |

## Providers soportados

- `discord` - OAuth con Discord
- `google` - OAuth con Google
- `platform` - Login nativo

## Variables de entorno

```
JWT_SECRET=<min 32 caracteres>
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BASE_URL=http://localhost:3000
```
