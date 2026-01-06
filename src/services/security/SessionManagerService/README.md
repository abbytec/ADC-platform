# SessionManagerService

Autenticación OAuth 2.0 con Access/Refresh Tokens y rotación de secretos.

## Endpoints

| Método | Ruta                           | Descripción                                                         |
| ------ | ------------------------------ | ------------------------------------------------------------------- |
| GET    | `/api/auth/login/:provider`    | Inicia login OAuth                                                  |
| GET    | `/api/auth/callback/:provider` | Callback OAuth                                                      |
| POST   | `/api/auth/login`              | Login nativo (username/password)                                    |
| GET    | `/api/auth/session`            | Verifica sesión (header `X-Refresh-Required` si necesita refresh)   |
| POST   | `/api/auth/refresh`            | Renueva tokens (cookie `refresh_token` en path `/api/auth/refresh`) |
| POST   | `/api/auth/logout`             | Cierra sesión                                                       |

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
