# Configuración administrada: values, configmaps y secretos

Dónde vive cada valor que la plataforma lee, y por qué en tres almacenes y no en uno.

El punto de partida es `env/*.env`, documentado en [../../env/README.md](../../env/README.md). Este
doc cubre lo que **ya no** vive ahí.

## Los tres almacenes

| | **values** | **configmaps** | **secretos** |
| --- | --- | --- | --- |
| Qué es | Perillas que declara el **código** | Configuración que declara el **despliegue** | Igual que un configmap, pero el valor no se devuelve nunca |
| Ejemplos | `AUDIT_LOG_RETENTION_DAYS`, `IDLE_TICK_SECONDS` | `MONGO_HOST`, `S3_ENDPOINT`, `GARAGE_CAPACITY` | `MONGO_PASSWORD`, `GARAGE_RPC_SECRET` |
| Lista blanca | Sí: `PlatformSettingsService/defaults.json` | No | No |
| Dónde | Mongo, `platform_settings` | Mongo, `config_maps` | Sobre sellado en el almacén de objetos (`adc-config`), índice en `config_secrets` |
| Dueño | `PlatformSettingsService` (`kernelMode 5`) | `ConfigStoreService` (`kernelMode 4`) | `ConfigStoreService` |

La distinción que importa: **values las declara quien escribe el código** (tienen default, ayuda y
grupo, y agregar una es agregarla al JSON), mientras que **configmaps y secretos los declara quien
opera el despliegue**. Por eso los primeros tienen lista blanca y los otros no.

## Alcances

`global` → `site:<sitio>` → `node:<id>`, y **gana el más específico**. Lo arma `scopeChain()` en
[sealer.ts](../../src/common/utils/config-store/sealer.ts) en un solo lugar, para que ningún
consumidor invierta la precedencia sin que nada falle.

Es lo que permite que `GARAGE_CAPACITY` o `ADC_NODE_ADVERTISE` —propios de una máquina— vivan en el
mismo sistema que lo compartido, sin volver a repartir archivos por nodo.

## Cómo llega un valor a un módulo

```
env/*.env ─┐
shell      ├─→ process.env ─┐
           ┘                 │
config_maps  ─┐              ├─→ ModuleLoader.interpolateEnvVars("${VAR:-default}")
bóveda        ├─→ managedConfig() ┘   precedencia: .env del módulo > almacenes > process.env > default
platform_settings ┘
```

`managedConfig()` ([managed-config.ts](../../src/common/utils/managed-config.ts)) es **síncrona a
propósito**: la consume la interpolación de los `config.json`, y volverla asíncrona obligaría a
reescribir la carga de módulos entera. Por eso los almacenes se leen una vez al arrancar y se
instalan como una foto en memoria.

**Un nombre vive en un solo almacén.** Si aparece en dos, el arranque falla nombrando los dos:
inventar una precedencia entre almacenes sería inventar una regla que nadie recuerda a los seis
meses, y el síntoma —un valor que «no toma»— aparece lejos de la causa.

Los valores resueltos se inyectan además en `process.env` con `??=`. Con eso los `docker-compose.yml`
y `bun run infra` reciben la configuración administrada **sin cambiar una línea**, y lo exportado en
el shell sigue ganando sobre todo.

## La frontera: qué NO puede administrarse

Lo que hace falta para leer los almacenes:

- `ADC_STORAGE_MASTER_KEY` — con ella se abren los sobres.
- `MONGO_HOST`, `MONGO_USER`, `MONGO_PASSWORD`, `MONGO_OPTIONS` — el índice.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` — la bóveda.
- La identidad del nodo (`ADC_NODE_ID`, `ADC_NODE_ROLE`, `ADC_NODE_SITE`).

Se quedan en `env/`, y `assertNoDevCredentials()` corta el arranque en producción real si alguna
quedó en su valor de desarrollo — no avisa: **aborta**. Con la bóveda detrás de la clave del almacén
de objetos, arrancar con la clave publicada en el repositorio la deja escribible por cualquiera.

## Cómo se protege un secreto

1. **Sobre AES-256-GCM** con sub-clave derivada por dominio (`adc-config-secret`), así que
   comprometer el material de otro uso no entrega la bóveda.
2. **AAD `secret:<alcance>:<nombre>`**: ata cada valor a su lugar. Sin esto, quien pueda escribir en
   el almacén copia el `MONGO_PASSWORD` sellado del alcance global al de un nodo —o lo pega bajo otro
   nombre— y se entrega como válido: GCM garantiza que esos bytes no se tocaron, nunca que estén
   donde corresponde.
3. **Un objeto por secreto**, no un paquete por alcance: escribir uno nunca reescribe otro, así que
   dos administradores no se pisan.
4. **Capabilities**: escribir exige `config:write` y revelar exige `config:reveal`. Sin eso,
   cualquier módulo que declarara el servicio en su `config.json` se llevaba la bóveda entera.
5. **Auditoría estricta al revelar**: la constancia se escribe **antes** de leer. Si no se puede
   dejar rastro de quién pidió una credencial, no se entrega.
6. **Redacción por valor exacto**: al cargarlos se registran en `redact.ts`, así que dejan de
   depender de que el valor *parezca* un secreto para no aparecer en un log.
7. **Nunca se devuelve en un listado**: `listSecrets()` da nombres, versión y digest, jamás el valor.

## Cuando la base o la bóveda no responden

Hay un respaldo local en `env/.cache/config.sealed.json` (`0600`), con lo no secreto en claro y los
secretos **sellados**. A diferencia de `env/secrets.env`, el archivo por sí solo no sirve sin la
master key.

Dos reglas que hacen que sea confiable:

- **Sólo una lectura completa lo reescribe.** Guardar una lectura a la que le faltan secretos
  borraría del respaldo justo lo que hace falta la próxima vez — que es la única razón por la que
  existe.
- **Con la bóveda caída y la base viva, los secretos salen del respaldo** y los configmaps de la
  base. El índice dice qué existe; el respaldo tiene los sobres de la última lectura buena.

## Rotar la master key

`scripts/rotate-master-key.mjs` rota **las DEK de usuarios y la bóveda en la misma corrida**. Son las
dos mitades de la misma operación: dejar la bóveda para un segundo comando garantiza que alguna vez
no se corra, y eso es el clúster sin ninguna credencial administrada.

Es reanudable —un secreto que ya abre con la clave nueva se saltea— y comprueba la ida y vuelta antes
de escribir. El respaldo local de cada nodo queda con la clave vieja y se regenera solo en el primer
arranque en que la base y la bóveda respondan enteras; hasta entonces ese nodo no puede arrancar sin
red, así que conviene rotar con el clúster alcanzable.

## Agregar una opción

- **value**: entrada en `PlatformSettingsService/defaults.json` (valor, `group`, `help`).
- **configmap o secreto**: se cargan en runtime; si además estaban en `env/`, marcarlas
  `source: "configmap" | "secret"` en `src/common/utils/env-manifest.ts` para que la auditoría sepa
  que su ausencia del archivo es correcta.
