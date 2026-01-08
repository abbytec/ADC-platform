# SessionManagerService

Autenticación OAuth 2.0 con Access/Refresh Tokens y rotación de secretos.

## Endpoints (via @RegisterEndpoint)

| Método | Ruta                           | Permisos | Descripción                      |
| ------ | ------------------------------ | -------- | -------------------------------- |
| GET    | `/api/auth/login/:provider`    | público  | Inicia login OAuth               |
| GET    | `/api/auth/callback/:provider` | público  | Callback OAuth                   |
| POST   | `/api/auth/login`              | público  | Login nativo (username/password) |
| POST   | `/api/auth/register`           | público  | Registro de nuevo usuario        |
| GET    | `/api/auth/session`            | público  | Verifica sesión                  |
| POST   | `/api/auth/refresh`            | público  | Renueva tokens                   |
| POST   | `/api/auth/logout`             | público  | Cierra sesión                    |

Usa `@EnableEndpoints()` y `@DisableEndpoints()` para registro automático via EndpointManagerService.

## Providers soportados

-   `discord` - OAuth con Discord
-   `google` - OAuth con Google
-   `platform` - Login nativo

## Variables de entorno

```
JWT_SECRET=<min 32 caracteres, solo si no se utiliza rotación de claves>
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

uso de ejemplo:

```json
"providers": [
    {
        "name": "security/jwt",
        "custom": {
            "jwtSecret": "${JWT_SECRET}"
        }
    }
]
```

## Seguridad

-   **Rotación de claves**: Cada 24h, `SECRET_PREVIOUS = SECRET_CURRENT` y se genera nueva clave
-   **Access Token**: JWT cifrado, 15 min, cookie `access_token`
-   **Refresh Token**: Opaco, 30 días, cookie HttpOnly en `/api/auth/refresh`
-   **Rate limiting**: 3 fallos login/día = bloqueo 1h; post-desbloqueo fallo = bloqueo permanente
-   **Geo-validation**: Cambio de país invalida sesión
