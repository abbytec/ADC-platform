# Fastify Server

Servidor HTTP con host-based routing, HTTP/2 y Connect RPC.

## Puertos
- `npm run start` → puerto 80
- `npm run start:prodtests` → puerto 3000

## HTTP/2
Habilitar con `HTTP2_ENABLED=true`. Requiere certificados SSL:
- `SSL_CERT_PATH`: Ruta al certificado
- `SSL_KEY_PATH`: Ruta a la llave privada
En desarrollo funciona sin certificados (cleartext, no para producción).

## Connect RPC
APIs REST tipo-seguras con Protocol Buffers. Compatibles con HTTP/1.1 y HTTP/2.

Uso: obtener instancia → `registerConnectRPC()` o `registerConnectService()`.

## Hosting
Configurar en `config.json` de cada app:
```json
"hosting": [{ "domains": ["example.com"], "subdomains": ["*"] }]
```
