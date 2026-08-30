# ConfigStoreService

Configuración administrada del clúster: **configmaps** (Mongo, `config_maps`) y **secretos**
(sellados con la master key, en el bucket `adc-config` del almacén de objetos; índice en
`config_secrets`).

`kernelMode 4`: corre antes que todo lo demás porque estos valores se interpolan en los
`config.json` de cada módulo. Por eso **no expone HTTP** — eso lo hace un servicio posterior.

- Alcances: `global` → `site:<sitio>` → `node:<id>`, gana el más específico.
- Los valores resueltos se inyectan en `process.env` con `??=`, así que Docker y `bun run infra`
  los reciben sin cambios.
- Respaldo local en `env/.cache/config.sealed.json` (`0600`): permite arrancar con Mongo o la
  bóveda caídos. Los secretos van sellados; sin la master key el archivo no sirve.
- Los valores secretos se registran en `redact.ts` al cargarlos, para que no aparezcan en logs.

Lo que **no** puede administrarse acá: la master key, y las credenciales de Mongo y del almacén de
objetos. Se leen para llegar a este store, así que viven en `env/`.
