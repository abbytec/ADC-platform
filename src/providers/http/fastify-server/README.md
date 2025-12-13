# Fastify Server

Servidor HTTP con host-based routing para producción.

## Puertos
- `npm run start` → puerto 80
- `npm run start:prodtests` → puerto 3000

## Hosting
Configurar en `config.json` de cada app:
```json
"hosting": [{ "domains": ["example.com"], "subdomains": ["*"] }]
```
