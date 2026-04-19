# Plan: Project Manager tipo Jira para ADC Platform

> Documento de planificación. Describe **qué** construir y **dónde** ubicarlo dentro de la plataforma, siguiendo los mismos patrones que `IdentityManagerService` + `adc-identity` y el patrón UI de `my-account`. No incluye código.

---

## 1. Análisis previo (cómo está hecho Identity / MyAccount)

Patrón observado y replicable:

- **Backend = Service** en `src/services/**` (ej. `core/IdentityManagerService`) con:
    - `config.json` (providers MongoDB, services dependientes, `kernelMode` si aplica).
    - `domain/*` — schemas Mongoose.
    - `dao/*` — Managers con lógica de negocio + `PermissionChecker` inyectado vía `AuthVerifierGetter`.
    - `endpoints/*` — clases decoradas con `@RegisterEndpoint` y habilitadas con `@EnableEndpoints` / `@DisableEndpoints`.
    - `utils/*` — helpers (crypto, auth-verifier, etc.).
    - `types.d.ts` + re-export de tipos desde `@common/types/**`.
- **Frontend = App UI** en `src/apps/public/**` (ej. `adc-identity`, `my-account`) con:
    - `config.json` → `uiModule` (React, `isHost: true`, `uiDependencies: ["adc-ui-library"]`, `serviceWorker`, `hosting.subdomains`, `devPort`).
    - `src/App.tsx` — carga permisos (`getMyPermissions`), resuelve tabs visibles, router interno.
    - `src/pages/*View.tsx` — una vista por recurso.
    - `src/utils/{entity}-api.ts` — cliente con `createAdcApi` de `@ui-library/utils/adc-fetch`.
    - `src/utils/permissions.ts` — matriz tabs ↔ scopes.
    - i18n por app, namespace `adc-platform`.
- **Contratos compartidos** en `src/common/types/**` (ej. `identity/User.ts`, `Permissions.ts`, `Actions.ts`, `resources.ts`).
- **UI reutilizable** en `src/apps/public/00-adc-ui-library/src/components/{atoms,molecules,organisms}` (Stencil web components `adc-*`) + `utils/tailwind-preset.js` con variables CSS semánticas (`primary`, `accent`, `surface`, `info`, `success`, `warn`, `danger`, `muted`, `text`, etc.).
- **Permisos** = bitfield `resource.scope.action` (ver `common/types/resources.ts`, `Actions.ts`, `identity/permissions.ts`). Los recursos se registran en `RESOURCES`.
- **Asignación de trabajo** ya soporta usuarios, **grupos** (`GroupManager`) y **roles** con scope global o por `orgId`.

Conclusión: vamos a replicar exactamente ese layering: **service backend** + **app UI** + **tipos en common** + **componentes genéricos en la ui-library**.

---

## 2. Entregables (resumen)

1. **Service backend** `src/services/data/ProjectManagerService/`
2. **App UI** `src/apps/public/adc-project-manager/` (subdominio `pm.adigitalcafe.com` — a confirmar)
3. **Tipos y utilidades compartidas** `src/common/types/project-manager/**` y `src/common/utils/project-manager/**`
4. **Componentes nuevos genéricos** en `00-adc-ui-library` (kanban board, gantt/calendar, priority picker, color-label, etc.)
5. **Registro del recurso** `project-manager` en `src/common/types/resources.ts` con sus scopes

---

## 3. Modelo de datos (MongoDB — multi-tenant por `orgId`)

Todas las entidades se almacenan en la **DB de la organización** (mismo patrón que Identity `forOrg()`), excepto `Project`, que tiene `orgId` indexado.

### 3.1. `Project`
- `id`, `orgId`, `slug` (único por org), `name`, `description`
- `ownerId` (userId), `visibility` (`private | org | public`)
- `memberUserIds[]`, `memberGroupIds[]` — asignación directa a usuarios o grupos (ver `IdentityManagerService.groups`)
- `roleOverrides[]` — `{ roleId, permissions[] }` para permisos por rol dentro del proyecto
- `kanbanColumns[]` — `{ id, key, name, order, color, isDone, isAuto }` (ver defaults §6)
- `customFieldDefs[]` — `{ id, name, type: "date" | "label" | "text" | "user" | "number", options?, required? }`
- `labels[]` — `{ id, name, color }` (paleta del preset: `primary`, `accent`, `info`, `success`, `warn`, `danger`, etc.)
- `issueLinkTypes[]` — `{ id, name, inverseName, color }` (ej. "blocks/blocked by", "duplicates", "relates to", "child of/parent of")
- `priorityStrategy` — `{ urgency, importance, difficulty, weights? }` (ver §8)
- `settings.wipLimits` — `{ columnKey → max }` (para el modo neurodivergente, §7)
- `createdAt`, `updatedAt`

### 3.2. `Sprint`
- `id`, `projectId`, `name`, `goal?`, `startDate?`, `endDate?`, `status: planned | active | completed`
- `createdAt`, `completedAt?`

### 3.3. `Milestone`
- `id`, `projectId`, `name`, `description?`, `startDate?`, `endDate?`, `status`
- Un issue puede pertenecer a **uno** o **ambos** (sprint y/o milestone).

### 3.4. `Issue`
- `id`, `projectId`, `key` (ej. `PROJ-123`, autoincremental por proyecto)
- `title`, `description` (markdown)
- `columnKey` (estado / columna del kanban)
- `category` (tipo de tarea: `task | bug | story | epic | ...` — configurable por proyecto)
- `sprintId?`, `milestoneId?`
- `reporterId` (userId que la creó — autofill)
- `assigneeIds[]` (users) y `assigneeGroupIds[]` (groups)
- `labelIds[]` (referencias a `Project.labels[]`)
- `priority` — `{ urgency: 0–4, importance: 0–4, difficulty: 1–5 | null }`
- `storyPoints?: number`
- `customFields: Record<fieldId, value>`
- `linkedIssues[]` — `{ linkTypeId, targetIssueId }` (agrupados en la UI por `linkTypeId`)
- `attachments[]` — `{ id, fileName, mimeType, size, storageKey, uploadedBy, uploadedAt }`
  - **Integración futura**: `storageKey` apunta a `internal-s3-provider`. Mientras no exista, persistir solo metadatos y dejar el upload detrás de un flag (stubs de endpoint preparados).
- `updateLog[]` — append-only: `{ at, byUserId, field, oldValue, newValue, reason? }`
  - Rango especial `description` → guarda snapshot completo para el popup de versiones viejas.
- `createdAt`, `updatedAt`, `closedAt?`

### 3.5. Índices recomendados
- `Issue`: `{ projectId, columnKey }`, `{ projectId, sprintId }`, `{ projectId, milestoneId }`, `{ projectId, key }` único, texto sobre `title/description`.
- `Project`: `{ orgId, slug }` único.

---

## 4. Service backend — `src/services/data/ProjectManagerService/`

### 4.1. Estructura
```
ProjectManagerService/
├── config.json                # providers: object/mongo; services: IdentityManagerService, EndpointManagerService, OperationsService
├── package.json
├── index.ts                   # BaseService, @EnableEndpoints
├── domain/                    # schemas: project, sprint, milestone, issue, (attachment meta)
├── dao/                       # ProjectManager, SprintManager, MilestoneManager, IssueManager, LabelManager, CustomFieldManager
├── endpoints/                 # projects.ts, sprints.ts, milestones.ts, issues.ts, links.ts, attachments.ts, custom-fields.ts, stats.ts
├── utils/                     # priority.ts (strategies), keygen.ts (PROJ-123), diff.ts (update log), perms.ts
└── types.d.ts
```

### 4.2. Dependencias
- `IdentityManagerService` — para resolver usuarios, grupos y verificar permisos (usar `AuthVerifierGetter` como Identity).
- `OperationsService` — para operaciones con stepper/rollback (ej. crear proyecto + columnas default + roles override).
- `EndpointManagerService` — para exponer endpoints REST.
- A futuro: provider `storage/internal-s3` para attachments.

### 4.3. Permisos
Registrar un nuevo recurso en `src/common/types/resources.ts`:

- `resource: "project-manager"`
- Scopes (bitfield, mismo patrón que `IdentityScopes`):
    - `PROJECTS` (1), `ISSUES` (2), `SPRINTS` (4), `MILESTONES` (8), `LABELS` (16), `CUSTOM_FIELDS` (32), `ATTACHMENTS` (64), `SETTINGS` (128), `STATS` (256)
- Acciones: las estándar `CRUDXAction`.
- Además, chequeo complementario **por proyecto**: membresía (`memberUserIds`/`memberGroupIds`) o `roleOverrides`. Se implementa en un `PermissionChecker` local que combina bitfield global + ACL por proyecto.

### 4.4. Endpoints (REST, bajo `/api/pm`)
- Proyectos: `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`, `POST /projects/:id/members`, `PUT /projects/:id/columns`, `PUT /projects/:id/labels`, `PUT /projects/:id/custom-fields`, `PUT /projects/:id/link-types`.
- Sprints: `GET/POST /projects/:id/sprints`, `PUT/DELETE /sprints/:id`, `POST /sprints/:id/start|complete`.
- Milestones: `GET/POST /projects/:id/milestones`, `PUT/DELETE /milestones/:id`.
- Issues: `GET /projects/:id/issues` (con filtros: `sprintId`, `milestoneId`, `assigneeId`, `labelIds`, `columnKey`, `q`, `orderBy`), `POST /projects/:id/issues`, `GET/PUT/DELETE /issues/:id`, `POST /issues/:id/move` (cambio de columna con validación WIP), `POST /issues/:id/links`, `DELETE /issues/:id/links/:linkId`, `GET /issues/:id/history` (update log), `POST /issues/:id/attachments` (stub hasta que exista S3 interno).
- Stats: `GET /projects/:id/stats` (burndown por sprint, throughput, WIP por columna).

### 4.5. Update log
- En cada `PUT /issues/:id`, el `IssueManager` calcula diff campo a campo (`utils/diff.ts`) y agrega entradas a `updateLog`. Para `description`, se guarda snapshot para reconstruir versiones históricas en el popup.

### 4.6. Hot-reload / multi-tenant
- Usar el mismo patrón `forOrg(orgSlug, mode)` que `IdentityManagerService`: conexión por región + DB por org.

---

## 5. App UI — `src/apps/public/adc-project-manager/`

### 5.1. `config.json`
- `uiModule`: `framework: "react"`, `isHost: true`, `serviceWorker: true`, `uiDependencies: ["adc-ui-library"]`, `uiNamespace: "adc-platform"`, `devPort` libre (ej. 3018), `sharedLibs: ["react", "tailwind"]`, `i18n: true`, `hosting.subdomains: ["pm"]`.
- `services`: `ProjectManagerService` + `IdentityManagerService` (si expone cliente).

### 5.2. Estructura
```
adc-project-manager/
├── config.json
├── i18n/{es,en}/adc-project-manager.json
├── index.html, index.ts, main.tsx
├── src/
│   ├── App.tsx                   # carga permisos, selector de proyecto, router
│   ├── pages/
│   │   ├── ProjectListView.tsx
│   │   ├── ProjectSettingsView.tsx  # miembros, columnas, labels, custom fields, link types, priority strategy, WIP limits
│   │   ├── BoardView.tsx            # kanban
│   │   ├── CalendarView.tsx         # calendar/gantt
│   │   ├── BacklogView.tsx          # list
│   │   ├── SprintsView.tsx
│   │   └── MilestonesView.tsx
│   ├── components/
│   │   ├── IssueDialog.tsx          # crear/editar issue
│   │   ├── IssueDetailDrawer.tsx    # detalle + update log + links + attachments
│   │   ├── UpdateLogPopup.tsx       # popup de descripciones viejas
│   │   ├── PriorityPicker.tsx
│   │   ├── LabelPicker.tsx
│   │   ├── AssigneePicker.tsx       # users + groups
│   │   └── CustomFieldsEditor.tsx
│   ├── utils/
│   │   ├── pm-api.ts                # createAdcApi({ basePath: "/api/pm" })
│   │   ├── permissions.ts           # tabs visibles según scopes
│   │   ├── priority.ts              # reusa common/utils/project-manager/priority
│   │   └── focus-mode.ts            # lógica visual para neurodivergentes (§7)
│   └── styles/tailwind.css
└── tsconfig.json
```

### 5.3. Navegación
- Tabs top-level: **Projects**, y dentro de un proyecto: **Board | Calendar | Backlog | Sprints | Milestones | Settings** (condicionados por permisos).
- Router interno igual que `adc-identity` (usa `@common/utils/router`).

### 5.4. Vistas

#### Kanban (`BoardView`)
- Columnas dinámicas desde `Project.kanbanColumns[]`, drag & drop entre columnas → `POST /issues/:id/move`.
- Filtros (asignado, sprint, label, prioridad, texto).
- Agrupado por **Sprint activo** por default, con opción de **Milestone** o **sin agrupar**.

#### Calendar / Gantt (`CalendarView`)
- Eje temporal con barras por issue usando `startDate?` / `dueDate?` (se agregan al schema como custom fields base).
- Toggle **calendar ↔ gantt**; filas agrupables por sprint / milestone / asignado.

#### Backlog / List (`BacklogView`)
- Tabla densa con columnas configurables (incluye custom fields).
- Ordenamiento por **priority strategy** (§8) u otras columnas.

### 5.5. Asignación a usuarios / grupos
- `AssigneePicker` consume la API de Identity (`GET /api/identity/users/search`, `GET /api/identity/groups?orgId=...`).
- Guardado en `assigneeIds[]` y `assigneeGroupIds[]`.

---

## 6. Columnas Kanban default
Al crear un proyecto se persisten estas columnas (editables, reordenables, eliminables desde Settings):

1. **Ideas / Backlog**
2. **To Do** (por defecto: las issues recién creadas caen aquí automáticamente — `isAuto: true`)
3. **In Progress**
4. **Test**
5. **Finalizado** (marca `isDone: true` → `closedAt` se completa al mover aquí)

Restricciones: siempre debe existir al menos una columna `isAuto` y al menos una `isDone`.

---

## 7. Modo “enfoque para neurodivergentes”
- En `Project.settings.wipLimits` se define `N` por columna (ej. `in-progress: 3`).
- En **Kanban** y **Backlog**, si el usuario actual (o el board) tiene **≥ N** issues en `in-progress`:
    - Las issues de cualquier **otra** columna (incluyendo `finalizado`) se pintan con clase `opacity-40 grayscale` (Tailwind) y `text-muted`.
    - Las issues de `in-progress` quedan en color normal → foco visual.
- Toggle manual “Focus mode” en la topbar del board para forzarlo/anularlo.
- Columna **Finalizado** siempre colapsable y con estilo `muted` por defecto.

---

## 8. Prioridad y estrategias de ordenamiento

### 8.1. Ejes
- `urgency`: `none | low | medium | high | critical` → `0..4`
- `importance`: `none | low | medium | high | critical` → `0..4`
- `difficulty`: `1..5` (opcional; algunos proyectos lo usan como “motivación” y lo excluyen del score)

### 8.2. Strategies (configurables por proyecto en `priorityStrategy`)
- `matrix-eisenhower`: orden lexicográfico `(urgency desc, importance desc)`.
- `weighted-sum`: `score = wU·urgency + wI·importance − wD·difficulty` (pesos configurables, `wD` puede ser 0).
- `wsjf-like`: `(urgency + importance) / max(difficulty, 1)`.
- `custom`: función pura registrada en `common/utils/project-manager/priority.ts` (para poder usarse igual en back y front).

### 8.3. Uso
- Backend: `IssueManager.list()` aplica `orderBy=priority` con la strategy del proyecto.
- Frontend: mismo helper importado desde `@common/utils/project-manager/priority` para orden local / preview.
- Dificultad como **filtro**: el Backlog permite excluir tareas por rango de `difficulty` (modo motivación).

---

## 9. Qué va en `src/common/**` (reutilizado por back y front)

- `src/common/types/project-manager/`
    - `Project.ts`, `Sprint.ts`, `Milestone.ts`, `Issue.ts`, `Label.ts`, `CustomField.ts`, `IssueLink.ts`, `Attachment.ts`, `UpdateLogEntry.ts`
    - `permissions.ts` (scopes/bitfields del recurso `project-manager`)
    - `index.d.ts` (re-export)
- `src/common/utils/project-manager/`
    - `priority.ts` (strategies puras)
    - `focus.ts` (cálculo de cuáles issues deben “apagarse”)
    - `diff.ts` (builder de entradas de update log)
    - `keygen.ts` (formato `PROJ-123`)
- `src/common/types/resources.ts`
    - Añadir `{ id: "project-manager", label: "resources.project-manager", scopes: PM_SCOPES }`.

---

## 10. Qué va en `00-adc-ui-library` (componentes genéricos)

Nuevos web components Stencil (siguiendo nomenclatura `adc-*`, usando variables del `tailwind-preset.js`):

- **atoms**
    - `adc-color-label` — chip con color personalizable de la paleta semántica.
    - `adc-priority-indicator` — pill urgencia/importancia/dificultad.
    - `adc-user-chip` — avatar + nombre (ya hay `adc-badge`; este es más rico).
- **molecules**
    - `adc-kanban-card` — tarjeta de issue genérica (title, labels, assignees, priority, story points, estado “muted”).
    - `adc-diff-viewer` — muestra diff old/new (para el popup del update log).
    - `adc-attachments-list` — lista con preview + acción upload (stub si no hay provider).
- **organisms**
    - `adc-kanban-board` — columnas drag&drop, slots para cards, respeta WIP limits y `focusMode`.
    - `adc-gantt-timeline` — eje temporal, barras, agrupadores, hoy.
    - `adc-data-table` — tabla ordenable/filtrable (si no existe ya una suficientemente genérica).

Regla: **todos** los nuevos componentes usan:
- Colores del `tailwind-preset.js` (`primary`, `accent`, `info`, `success`, `warn`, `danger`, `muted`, `text`, `surface`, etc.).
- Utilidades existentes en `00-adc-ui-library/utils/` (`i18n-react`, `adc-fetch`, `permissions`, `session`, `error-handler`).
- `adc-modal`, `adc-combobox`, `adc-tabs`, `adc-badge`, `adc-skeleton`, `adc-dropdown-menu`, `adc-toast-manager` ya existentes (no reinventar).

Los componentes **específicos del PM** que no serían útiles en otras apps (ej. selector de link-type, custom-fields editor acoplado al modelo PM) se quedan en `adc-project-manager/src/components/`.

---

## 11. i18n, routing y hosting

- i18n: `src/apps/public/adc-project-manager/i18n/{es,en}/adc-project-manager.json`. Claves principales: `tabs.*`, `views.board.*`, `views.calendar.*`, `views.backlog.*`, `issue.*`, `priority.*`, `columns.*`, `focusMode.*`, `linkTypes.*`, `customFields.*`.
- Hosting: subdominio nuevo `pm` (sobre `adigitalcafe.com`) — añadirlo al `config.json` del app.
- i18n de scopes: sumar `resources.project-manager` y `permissions.projects|issues|sprints|...` a los archivos de `adc-identity` para que aparezca bonito en el matrix de roles.

---

## 12. Seguridad y validaciones

- Toda mutación pasa por `PermissionChecker` (bitfield) + chequeo de membresía del proyecto.
- El `reporterId` se autofill desde el token en backend (no se acepta del cliente).
- `PROJ-key` se genera atómicamente en `IssueManager.create()` usando un contador por proyecto (igual patrón que otros IDs en Identity — ver `utils/crypto.ts`).
- `attachments`: validar mime/size; en fase 1 solo metadata, sin subida real (stub 501 si se llama al upload).
- Update log es append-only; endpoint de edición del log **no existe**.

---

## 13. Testing / Lint / Build

- TypeScript: incluir el nuevo service y app en `tsconfig.base.json` paths si se usan alias.
- Correr `npm run typecheck`, `npm run lint` y `npm run build:ui` tras cada fase.
- Hot-reload: los cambios en `config.json` del app re-spawnean la instancia; ok tal cual el kernel actual.

---

## 14. Fases de entrega

1. **Fase 1 – Fundaciones**
    - Tipos en `@common/types/project-manager/*`, resource registrado, permissions helpers.
    - Esqueleto del service + schemas + endpoints vacíos.
2. **Fase 2 – CRUD core**
    - Projects, Sprints, Milestones, Issues (sin links ni attachments), update log básico.
    - App UI: selector de proyecto, Backlog + IssueDialog.
3. **Fase 3 – Board + Calendar**
    - `adc-kanban-board` y `adc-gantt-timeline` en ui-library, vistas Board y Calendar, drag&drop + move endpoint.
4. **Fase 4 – Configuración del proyecto**
    - Columnas, labels, custom fields, link types, priority strategy, WIP limits (ProjectSettingsView).
    - Custom fields aplicados en IssueDialog + Backlog.
5. **Fase 5 – Links, update log rico, focus mode**
    - Issue links con tipos, `UpdateLogPopup` con `adc-diff-viewer`, modo neurodivergente.
6. **Fase 6 – Attachments**
    - Metadata + stub de upload; conectar cuando exista `internal-s3-provider`.
7. **Fase 7 – Stats y pulido**
    - Burndown, throughput, mejoras a11y, i18n EN completo.

---

## 15. Decisiones abiertas (a confirmar antes de codear)

- Subdominio definitivo (`pm.` / `tasks.` / `projects.`).
- Si existe algo previo en la plataforma para “difficulty” que debamos reutilizar.
- Paleta concreta para `Label.color` (proponer: mapear a las variables semánticas del preset + un set extendido neutro).
- Estrategia definitiva para attachments mientras no exista `internal-s3-provider` (¿ocultar UI o dejarla en modo read-only?).
