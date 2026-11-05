# Plan de implementación — TimeManager SaaS

Roadmap **ejecutable** para convertir TimeManager en una plataforma de renta de checadas multi-cliente. Cada tarea tiene un ID, archivos, criterio de "hecho" y pruebas, para trabajarla en una sesión o PR propio.

- El **porqué** de cada decisión vive en [SAAS_PLAN.md](SAAS_PLAN.md) (tenancy, identidad, planes) y [ARQUITECTURA.md](ARQUITECTURA.md) (escala, colas, BD, web).
- Este archivo es el **qué y en qué orden**. Al terminar una tarea, se marca `[x]` aquí en el mismo commit.

Última actualización: 2026-11-04 (auditoría de runtime y despliegue; ver ARQUITECTURA §5).

---

## 0. Cómo usar este plan

1. Toma la **primera tarea sin marcar** de la fase activa (las fases van en orden; dentro de una fase, el orden importa salvo que diga "paralelizable").
2. Lee los documentos que cita la tarea y la ficha del módulo en `docs/modules/`.
3. Implementa solo esa tarea. Si descubres trabajo extra, agrégalo como tarea nueva aquí; no lo metas en el mismo cambio.
4. QA mínima antes de marcarla: `pnpm typecheck`, `pnpm lint`, pruebas de la tarea. **No correr E2E** salvo que se pida.
5. Actualiza docs (`docs/modules/<modulo>.md`, este plan) en el mismo commit.

Plantilla para pedírsela a un agente:

```
Implementa la tarea <ID> de docs/PLAN_IMPLEMENTACION.md.
Lee antes: AGENTS.md, docs/SAAS_PLAN.md §4.1, docs/modules/<modulo>.md.
Al terminar: pnpm typecheck, pnpm lint, las pruebas de la tarea, y marca <ID> como [x].
```

---

## 1. Producto y alcance

- **Qué vendemos**: solo el servicio de **checadas** (registro de asistencia por reloj biométrico + RH de soporte: personal, horarios, horas extra, pre-nómina, reportes).
- **Modelo**: plataforma de **renta** (SaaS). N clientes × N empleados, cada cliente aislado.
- **Fuera del producto**: tickets, inventario, cocina y las pantallas web del guardia (bitácora, entradas/salidas). El guardia opera desde su **app móvil** contra el módulo `access` del API, que se conserva.
- **Cargas de diseño**: ver [ARQUITECTURA.md §0](ARQUITECTURA.md). Primer objetivo comercial: 50 clientes × ~100 empleados (5k personas); el diseño aguanta 100 clientes × 5k.

---

## 2. Estado actual (hecho)

- [x] Extracción RH standalone desde el ERP de Puerto Nuevo, baseline Prisma `20261104000000_baseline_rh` (36 modelos).
- [x] Paquete de marca: paleta azul marino `#1D2636` / ámbar `#F2A93B`, logos, favicons, lotties.
- [x] Tema global de la web con la paleta de marca; tokens `--tm-*` en `web/src/app/index.css`.
- [x] Login rediseñado (panel de marca, textos de RH, modo oscuro, móvil).
- [x] Roles nuevos: `ADMIN`, `SUPPORT`, `CLIENT_ADMIN`, `HUMAN_RESOURCES`, `CLIENT_STAFF` (seed-data + código + i18n).
- [x] BD de Railway migrada con el baseline y sembrada; usuario de plataforma `martin.amaro` (ADMIN).
- [x] Menú podado: fuera tickets, inventario, cocina, bitácora y entrada/salida.
- [x] Monorepo con pnpm workspaces (un lockfile, scripts raíz, Dockerfiles con contexto raíz).
- [x] Decisiones D1 (schema compartido + `tenantId`), D2 (usuario pertenece a un solo cliente), D3 (subdominio).

---

## 3. Arquitectura objetivo

### 3.1 Vista general

```
           *.timemanager.mx  (subdominio = cliente)
                     │
                CDN + Load balancer
                     │
      ┌──────────────┼───────────────┐
   api × N        workers × M     scheduler × 1
 (HTTP stateless) (sync relojes,  (encola periódicos,
                   asistencia,     lock de líder)
                   correo, export)
      │               │
  PgBouncer         Redis (cola BullMQ, caché, rate limit)
      │
  Postgres (una BD, todas las tablas de cliente con tenantId + RLS)
      │
  S3 (prefijo tenant/<id>/)     Ably (canales por tenant)
```

- **Monolito modular**: un solo API Express con módulos por dominio. No hay microservicios; los workers son el mismo código corriendo en otro proceso.
- **Multi-tenant en una sola BD**: `tenantId` en cada tabla de cliente. Aislamiento en dos capas: extensión de Prisma (automática) + Row-Level Security de Postgres (red de seguridad).
- **Plataforma vs cliente**: `ADMIN`/`SUPPORT` no pertenecen a un cliente; operan sobre uno eligiéndolo (`X-Tenant-Id`).

### 3.2 Aislamiento por cliente (cómo funciona)

| Capa | Mecanismo |
|---|---|
| Request | Subdominio → slug → tenant. El JWT lleva `tenantId`; el middleware lo compara con el de la BD y bloquea clientes suspendidos. |
| Contexto | `AsyncLocalStorage` con `{ tenantId, platform }` durante toda la petición. |
| ORM | Extensión de Prisma: agrega `tenantId` al `where` de toda lectura/escritura y al `data` de todo `create`. Nadie filtra a mano. |
| BD | Columna `tenantId NOT NULL` + FK + índices compuestos; RLS con `current_setting('app.tenant_id')` (fase 1b). |
| Workers | Corren **una vez por cliente** dentro de su contexto; la extensión filtra igual que en HTTP. |
| Archivos / realtime | Prefijo S3 `tenant/<id>/…`; canales Ably `tenant:<id>:…`. |

### 3.3 Roles

| Rol | Quién | Alcance |
|---|---|---|
| `ADMIN` | Equipo TimeManager | Todo, incluidos roles y configuración de plataforma |
| `SUPPORT` | Equipo TimeManager | Usuarios, relojes, horarios y asistencia; sin expedientes ni nómina |
| `CLIENT_ADMIN` | Cliente | Toda la operación de su empresa |
| `HUMAN_RESOURCES` | Cliente | Expedientes, altas, checadas, horarios, horas extra, nómina |
| `CLIENT_STAFF` | Cliente | Solo su propia asistencia |

Matriz completa: `api/prisma/seed-data/role_permissions.json`.

### 3.4 Decisiones

| ID | Decisión | Estado |
|---|---|---|
| D1 | Una BD, schema compartido, `tenantId` + RLS | Cerrada |
| D2 | Usuario pertenece a un solo cliente; únicos por cliente | Cerrada |
| D3 | Cliente por subdominio | Cerrada (falta dominio) |
| D4 | Datos plataforma vs cliente (ver §F1A-01) | Cerrada |
| D5 | Planes y cobro (por empleado activo/mes; Stripe vs Conekta vs manual) | **Pospuesta** (hay que considerarla en F3-04; no bloquea S1–S3) |
| A1 | Cola: BullMQ + Redis vs pg-boss (sin Redis) | **Cerrada**: pg-boss (sin Redis), mismo Postgres, esquema `pgboss` |
| A2 | Proveedor de Postgres (límites de conexiones, PgBouncer, réplicas) | **Cerrada**: se queda Railway + PgBouncer (F1B-07); falta confirmar plan y límite de conexiones |
| A3 | Dominio de producción (`timemanager.mx`?) | **Cerrada**: `timemanager.mx` (compra del dominio pendiente) |
| D6 | ¿El cliente actual migra? | **Cerrada**: arrancamos limpios, sin migrar datos de Puerto Nuevo |
| A4 | Cómo alcanza el API a los relojes on-prem de cada cliente | **Cerrada**: agente desktop instalado en una PC del cliente (mismo modelo que `~/DEV/PTNV/AXZY_PTNV_SERVERS/agente`): se conecta al reloj por LAN, hace sync/escrituras y habla con la nube por conexión saliente |

---

## 4. Fases y tareas

### Fase 1a — Multi-tenant interno (activa)

Objetivo: dos clientes pueden convivir en la misma BD sin verse. Detalle técnico en [SAAS_PLAN.md §4.1](SAAS_PLAN.md).

- [x] **F1A-01 Esquema Prisma.** Modelo `Tenant` (`id`, `name`, `slug` único, `status` ACTIVE/SUSPENDED, `timezone`, `plan`, `employeeLimit`). `tenantId` obligatorio en 22 tablas de cliente (`Department`, `Subarea`, `DocumentType`, `RemovalCategory`, `EmployeeDiscount`, `EmployeeDocument`, `DisciplinaryReport`, `Notification`, `Site`, `AccessEvent`, `Schedule`, `ScheduleDay`, `ScheduleAssignment`, `PayrollWeekClosure`, `PayrollDepartmentReview`, `OvertimeApproval`, `TimeClock`, `TimeClockPunch`, `TimeClockSyncEvent`, `TimeClockEmployee`, `TimeClockRosterEntry`, `TimeClockRosterRun`) con `@default(dbgenerated("current_setting('app.tenant_id'::text, true)"))` para que sea opcional en TS y falle en BD si nadie lo pone. `tenantId` opcional en `User`, `AuditLog`, `EmailLog` (null = plataforma).
  - Unicidades por cliente: `users.(username|email|employeeNumber)`, `departments.name`, `document_types.name`, `schedules.name`, `removal_categories.key`, `sites.(name|code)`, `payroll_week_closures.weekStart`, `time_clocks.url`.
  - `TimeClockEmployee`: PK pasa de `employeeNumber` a `(tenantId, employeeNumber)`.
  - Sin relación Prisma hacia `Tenant` en los 25 modelos (FK solo en SQL).
  - Archivos: `api/prisma/schema.prisma`.
  - Hecho cuando: `prisma validate` y `prisma format` limpios.

- [x] **F1A-02 Migración SQL a mano** `api/prisma/migrations/20261105000000_tenancy/migration.sql` (+ `rollback.sql`).
  - Base: `prisma migrate diff --from-schema-datamodel <schema de HEAD> --to-schema-datamodel prisma/schema.prisma --script` (sin shadow DB; **nunca** usar `DATABASE_URL` como shadow).
  - Editar a mano: crear `tenants` → insertar tenant `demo` → `ADD COLUMN` nullable → backfill a `demo` (usuarios: solo los que no son `ADMIN`/`SUPPORT`) → `SET NOT NULL` → FKs `ON DELETE RESTRICT` → únicos compuestos + **índices únicos parciales** `WHERE "tenantId" IS NULL` para usuarios de plataforma → `DEFAULT current_setting(...)`.
  - Hecho cuando: aplica limpio sobre una BD vacía y sobre una copia con datos; el rollback deja el esquema igual al baseline.
  - Verificado en Postgres 16 (Docker): aplica vacía y con datos; backfill correcto (ADMIN/SUPPORT → NULL, resto → demo); únicos por cliente, únicos parciales de plataforma, PK compuesta, FK y RESTRICT probados; inserción sin contexto falla ruidosamente; rollback con drift cero vs baseline; drift hacia adelante = solo los 25 FK y 3 únicos parciales (intencionales, FK solo en SQL).

- [x] **F1A-03 Contexto de tenant + extensión Prisma.** Nuevo `api/src/core/tenancy/` con:
  - `context.ts`: `AsyncLocalStorage<{ tenantId: string | null; platform: boolean }>`, `runWithTenant`, `currentTenantId`, `requireTenantId`.
  - `extension.ts`: función **pura** `scopeArgs(model, operation, args, tenantId)` + `$extends({ query: { $allModels: { $allOperations } } })` registrada en `core/config/database.ts`. Agrega `tenantId` a `where` (find*, count, aggregate, groupBy, update*, delete*, upsert) y a `data` (create, createMany, upsert.create). Sin contexto o plataforma sin cliente elegido: no toca nada.
  - Lista de modelos de cliente en un solo lugar (`TENANT_MODELS`).
  - **Bug de ALS encontrado en la prueba funcional**: las PrismaPromise son perezosas y enganchan su cadena interna en el primer `.then` — si el callback devuelve la promesa cruda, el primer await ocurre fuera del scope y se pierde el tenant. `runWithTenant` envuelve en async y hace el primer await dentro del contexto. También se corrigió `scopeArgs`: `upsert` tenía su propia rama pero caía primero en `READ_OPS` y el `create` quedaba sin `tenantId`.
  - Incluye adelantado de F1A-05: los `findUnique` por campo que dejó de ser único se cambiaron a `findFirst` (la extensión los filtra) y las mutaciones de `TimeClockEmployee` usan el compuesto `tenantId_employeeNumber` con `requireTenantId()`. `prisma generate` ya regenerado; `pnpm typecheck` y `pnpm lint` en verde (0 errores).
  - Prueba funcional E2E en Docker (BD limpia, ambas migraciones): 9/9 — aislamiento en findMany/findFirst/count, anti-hijack del where, inyección en create/createMany/upsert, updateMany filtrado, modelo de plataforma intacto y falla ruidosa sin contexto.
  - Hecho cuando: pruebas unitarias de F1A-08 pasan.

- [x] **F1A-04 Auth.**
  - `POST /auth/login` acepta `tenant` (slug). Con slug: busca `(tenantId, username)`; sin slug: solo usuarios con `tenantId IS NULL`. Cliente suspendido → 403.
  - JWT y refresh incluyen `tenantId`. `/auth/me` devuelve `tenant { id, slug, name, timezone }`.
  - `authenticate`: toma `tenantId` fresco de la BD, valida estado y abre `runWithTenant` para el resto de la petición. `X-Tenant-Id` solo se acepta para `ADMIN`/`SUPPORT` (validado contra `tenants`).
  - Archivos: `api/src/modules/auth/*`, `api/src/core/middlewares/auth.middleware.ts`, `api/src/core/utils/security.ts`.
  - Implementado: relación `User.tenant`/`Tenant.users` en schema (el FK ya existía en BD; sin migración). Refresh valida que el tenant del token coincida con el de la BD (si movieron al usuario de cliente, la sesión muere). `authenticate` corta en caliente si el cliente se suspende, rechaza el header `X-Tenant-Id` de usuarios de cliente (403) y el de plataforma con tenant inválido/suspendido (400). Nuevos códigos i18n `TENANT_SUSPENDED`, `TENANT_HEADER_FORBIDDEN`, `INVALID_TENANT_HEADER`.
  - Prueba funcional en Docker (fixture: admin plataforma + usuarios demo/acme-suspendido): **19/19** — login con/sin slug, slug inexistente, suspendido, refresh con rotación y con tenant ajeno, `/auth/me`, y 7 casos del middleware (contexto correcto, JWT ≠ BD, header prohibido/inválido/válido, plataforma sin header, suspensión en caliente).

- [x] **F1A-05 Servicios y workers.**
  - Reemplazar `findUnique` por campos que dejaron de ser únicos (`username`, `name`, `key`, `url`, `weekStart`, `employeeNumber`) por su único compuesto o `findFirst`.
  - Creaciones anidadas (`create: { … }` dentro de otro `create`) de modelos de cliente: pasar `tenantId: requireTenantId()` explícito (la extensión no entra a escrituras anidadas).
  - Workers (`startTimeClockWorker`, padrón/roster, cola de correo): iterar clientes `ACTIVE` y correr cada ciclo dentro de `runWithTenant(t.id, …)`.
  - Caches en memoria con datos de cliente: indexarlas por `tenantId` o eliminarlas.
  - Seed: `seedPermissionsFromFixtures` sigue siendo de plataforma; `RemovalCategory`/`DocumentType` plantilla se copian al crear un cliente.
  - Implementado: `core/tenancy/iterate.ts` (`forEachActiveTenant`/`activeTenants`) + `catalogs.ts` (`seedTenantTemplateCatalogs`, idempotente, desde `seed-data/tenant_template_catalogs.json`). Sync de relojes y roster corren una vez por cliente ACTIVE; la cola de correo procesa cada correo en el contexto de su tenant. Únicos creates anidados hallados: `ScheduleDay` en create/update de horarios (corregidos). Caches auditadas: las de relojes usan `serialNumber` (PK global, sin colisión) y `sys_config` es de plataforma — quedan documentadas. Prueba funcional Docker: 5/5.

- [x] **F1A-06 Endpoint de clientes (mínimo).** Módulo `tenants`: `GET /tenants` (ADMIN/SUPPORT), `POST /tenants` (ADMIN: crea tenant + su `CLIENT_ADMIN` + catálogos plantilla), `PATCH /tenants/:id` (estado). Ficha `docs/modules/tenants.md`.
  - Implementado: permisos nuevos `tenants.view` (ADMIN, SUPPORT) y `tenants.manage` (ADMIN), y además exige usuario de plataforma. Slug validado (formato y reservados), 409 si se repite. Sin contraseña genera una provisional que se devuelve una sola vez. Auditoría `TENANT_CREATED/UPDATED/SUSPENDED/REACTIVATED`. `runWithTenant` ahora tipa `Promise<Awaited<T>>`.
  - CORS: `WEB_ORIGIN` acepta lista y comodín de subdominio (`http://*.localhost:5006`).
  - Prueba funcional (Postgres 16 en Docker + API real): **20/20** — alta con catálogos, slug repetido/reservado, SUPPORT sin alta, uso, login del CLIENT_ADMIN por slug, `/auth/me` con tenant, 403 para usuarios de cliente (lista y `X-Tenant-Id`), suspensión/reactivación en caliente, 404, CORS por subdominio.

- [x] **F1A-07 Web.**
  - Login: slug desde el subdominio (`acme.localhost:5006` en local; `*.localhost` resuelve sin DNS). `app.`, `admin.` o sin subdominio = plataforma. Vite: `server.allowedHosts` con `.localhost`.
  - Selector de cliente en la barra superior para `ADMIN`/`SUPPORT` que manda `X-Tenant-Id` (interceptor axios) y recuerda la elección en `localStorage`.
  - Nombre del cliente visible en la barra superior.
  - Archivos: `web/src/features/auth/login`, `web/src/shared/api`, `web/src/app/guards/PrivateRoutes.tsx`.
  - Implementado: `shared/api/tenant.ts` (slug del host; `VITE_TENANT_BASE_DOMAIN` en producción), `entities/tenant`, `features/tenant/tenant-switcher` en el slot de la barra superior; login muestra la empresa del subdominio y el mensaje de cliente suspendido. PDFs y credencial usan el nombre del cliente (`shared/lib/tenantBrand.ts`) en lugar de "Puerto Nuevo". Verificado en navegador: login por `demo.localhost`, nombre en la barra, ADMIN cambia de cliente y la lista se filtra.

- [x] **F1A-08 Pruebas.**
  - Agregar `pnpm test:unit` al API (runner `node:test` + `ts-node`, sin BD).
  - Unitarias de `scopeArgs`: cada operación agrega el filtro; `create`/`createMany`/`upsert` inyectan; plataforma sin cliente no filtra; `tenantId` del cliente gana sobre uno enviado en `where`.
  - Script de aislamiento `api/scripts/tenancy-check.ts` contra una BD de prueba: crea tenants A y B con un empleado, horario y checada cada uno; comprueba que A no lista, lee por id, edita ni borra lo de B; limpia al final.
  - Implementado: `pnpm test:unit` (node:test + ts-node, `src/**/*.test.ts`): 18 pruebas de `scopeArgs`, contexto ALS, CORS y DTO de tenants. Encontró y corrigió un bug: `createMany` con `data` como objeto (válido en Prisma) rompía `scopeArgs`. `pnpm tenancy-check` solo lee `TENANCY_CHECK_DATABASE_URL` (nunca `DATABASE_URL`): **13/13** en Postgres 16 (Docker), sin residuos.

- [x] **F1A-10 Plataforma sin cliente elegido.** Hoy ADMIN/SUPPORT sin `X-Tenant-Id` ven en las pantallas de cliente los datos de **todos** los clientes mezclados, y las altas fallan en BD (sin `tenantId`). Pedir elegir cliente antes de abrir pantallas de cliente (o abrir directo en la consola F3-01).
  - Implementado: sin cliente elegido, ADMIN/SUPPORT solo ven Inicio (consola), Roles y Avisos (`PLATFORM_PATHS` en `features/tenant/tenant-switcher`); cualquier otra ruta redirige a `/` y el menú esconde grupos vacíos.
- [ ] **F1A-11 Login en la app de escritorio.** Electron no tiene subdominio: agregar campo de empresa (solo en escritorio) o configurar el slug por instalación.

- [x] **F1A-09 Aplicar y verificar.** Migración en Railway, crear 2 tenants de prueba, login por subdominio de cada uno, correr `tenancy-check`, actualizar fichas de módulos y `AGENTS.md`.
  - 2026-11-04, verificado (solo lectura): Railway ya tiene `20261104000000_baseline_rh` y `20261105000000_tenancy` aplicadas ("Database schema is up to date"). Estado: tenant `demo` ACTIVE, un usuario `ADMIN` de plataforma (`tenantId` null), cero datos de negocio (departamentos, horarios, relojes, checadas, catálogos), así que no hubo backfill que revisar.
  - Hecho (autorizado): permisos `tenants.*` sembrados; catálogos plantilla en `demo`; tenant `prueba` creado; `CLIENT_ADMIN` `admin.demo` y `admin.prueba` con contraseña provisional (obligados a cambiarla). Login por slug **12/12** (cada uno entra solo por su subdominio, no sin slug ni por el ajeno; cada cliente ve solo sus usuarios y catálogos). `tenancy-check` contra Railway **13/13**, sin residuos (quedan solo `demo` y `prueba`).

### Fase 1b — Endurecimiento del aislamiento y de la escala

- [x] **F1B-01 RLS en Postgres.** Políticas `USING ("tenantId" = current_setting('app.tenant_id'))` en las 22 tablas; la extensión hace `SET LOCAL app.tenant_id` por transacción; rol de BD de la app sin `BYPASSRLS`; rol de workers/plataforma aparte.
  - Implementado: migración `20261108000000_rls_tenant_isolation` (función `app_current_tenant_id()`, ENABLE+FORCE RLS y política `tenant_isolation` con USING/WITH CHECK en todas las tablas con `tenantId` NOT NULL), `api/prisma/rls/roles.sql` (`tm_app` sin BYPASSRLS, `tm_worker` con BYPASSRLS), extensión `tenancy/extension.ts` (`set_config(..., true)` dentro de una transacción por operación, `insideRlsTransaction()` para no anidar) y helper `tenantTransaction` para las 34 transacciones interactivas. Bypass controlado pre-contexto (`app_bypass_rls`, migración `20261108003000_rls_bypass` + `runWithRlsBypass`) para login y token de agente, probado en `infra.flow.test.ts`. `RLS_ENABLED=true` probado con la suite completa en `tm_test_infra` (verde, mismo número de tests); `infra.flow.test.ts` prueba con un rol restringido real que sin contexto no ve filas y que WITH CHECK rechaza otro tenant. Guía: `docs/OPERACION_PRODUCCION.md` §2.
- [x] **F1B-02 Workers fuera del proceso web.** `api/src/workers/index.ts` como segundo entrypoint (mismo código); el API ya no arranca sync ni correo. Requisito para correr 2+ réplicas del API (ARQUITECTURA §1.1).
  - Implementado: `api/src/workers/{index,runtime}.ts` (`pnpm --filter timemanager-api workers`), lock de líder en Postgres (`worker_locks` + `LeaderElection`, latido con TTL y toma por caducidad), `api/src/index.ts` deja de arrancar workers salvo `RUN_WORKERS_IN_API=true` (local) y agrega `SIGTERM`/`$disconnect` ordenado. Tests: `infra.flow.test.ts` con dos clientes Prisma (solo uno toma el lock; el heartbeat caducado lo libera). Guía: `docs/OPERACION_PRODUCCION.md` §1.
- [x] **F1B-03 Cola** (según A1): sync de relojes, cálculo de asistencia, exports xlsx/PDF y correo como trabajos por cliente.
  - Implementado: `api/src/core/queue/pg-boss.ts` (pg-boss 9, esquema `pgboss`, sin Redis) con jobs periódicos programados por el líder (`email.drain`, `time-clock.sync`, `roster.run`) y `agent.job` para el agente on-prem (`registerAgentJobHandler`/`enqueueAgentJob`). El drenado de correo reclama filas (`updateMany` sobre PENDING) para no duplicar envíos con 2+ workers. Cálculo de asistencia semanal: caché corta por tenant y sin `limit: 100000` (la materialización nocturna por job queda como siguiente paso). Guía: `docs/OPERACION_PRODUCCION.md` §3.
- [x] **F1B-04 Zona horaria por cliente** en `computeWorkday`, reportes y cortes de "hoy".
  - Implementado: `core/utils/tenant-timezone.ts` (cache 60 s) y precedencia en `resolveTimezoneWithConfig`: explícita → `Tenant.timezone` → `sys_config.ACCESS_REPORT_TIMEZONE` → env → default. Cubre weekly-attendance/OT (`computeWorkday`), reportes de reloj/acceso, asistencia por persona, dashboard y el corte de "hoy" del resumen de relojes. Tests: unit de `computeWorkday` (retardo/OT con CDMX vs Tijuana) e integración `tenant-timezone.flow.test.ts` (checada 07:30Z cae el día 5 en CDMX y el 4 en Tijuana; `range.timezone` del reporte semanal por cliente).
- [x] **F1B-05 S3 con prefijo `tenant/<id>/`** y canales Ably `tenant:<id>:*`.
  - Implementado: `storage.ts` aplica `scopedObjectKey` (idempotente; compat con objetos históricos sin prefijo y sin contexto) en upload/download/signed URL; `ably.ts` publica en `tenant:<id>:user:<id>` (y en el canal histórico `user:<id>` mientras la web migra) y agrega `broadcastToTenant` (`tenant:<id>:broadcast`). Unit `tenant-scope.test.ts`. Pendiente del lado web: suscribirse al canal con prefijo.
- [x] **F1B-06 Relojes con API key por cliente** (alta del reloj = serial + key ligada al tenant).
  - Implementado: `TimeClock.apiKeyHash/apiKeyPrefix/apiKeyCreatedAt` (migración a mano `20261111000000_clock_api_key`, hash SHA-256 y único), `POST /time-clock/clocks/:serial/key` (rota y muestra la key una sola vez), `POST /time-clock/ingest` sin JWT autenticado con `X-Clock-Key`/Bearer + serial: guarda checadas en el contexto del cliente dueño, idempotente por `(clockSerial, serialNo)`, con rate limit. Test `clock-api-key.flow.test.ts` (rotación, estado sin key en claro, ingesta, reintento idempotente, 401 con key incorrecta/ajena y aislamiento entre clientes).
- [x] **F1B-07 PgBouncer + `connection_limit`** (regla: réplicas × límite ≤ 70 % del máximo de la BD).
  - Implementado: `DATABASE_CONNECTION_LIMIT`, `DATABASE_POOL_TIMEOUT` y `DATABASE_PGBOUNCER` se agregan a la URL de Prisma (`core/config/database.ts`). Guía PgBouncer/Railway sin aplicar en la nube: `docs/OPERACION_PRODUCCION.md` §4.
- [x] **F1B-08 Índices de alto volumen**: `time_clock_punches (tenantId, employeeNumber, occurredAt)`, `access_events (tenantId, …, occurredAt)`.
  - Implementado: migración a mano `20261108001000_high_volume_indexes` (incluye `email_logs (tenantId, status, nextAttemptAt)`).
- [x] **F1B-10 Credenciales del reloj por reloj, en BD.** Hoy `TIME_CLOCK_USER/PASS` es global: todos los relojes comparten el mismo admin, y con un reloj por cliente cada equipo tendrá su propia contraseña. Mover usuario y contraseña al modelo `TimeClock` (cifrados en reposo con una `ENCRYPTION_KEY`), que `IsapiClient` reciba las del reloj y el `.env` quede solo como default de desarrollo. El API nunca devuelve la contraseña (solo si está configurada). Migración SQL a mano + backfill desde el `.env` para los relojes actuales. Archivos: `api/prisma/schema.prisma`, `api/prisma/migrations/*`, `api/src/modules/time-clock/**`, `api/src/core/utils/crypto*.ts`.
  - Implementado: `TimeClock.username` + `TimeClock.passwordEncrypted` con migración a mano `20261106000000_clock_credentials` (sin tocar las anteriores); `ENCRYPTION_KEY` (base64 32 bytes) con derivación HKDF-SHA256 desde `JWT_SECRET` y warning único si falta; `encryptSecret`/`decryptSecret` AES-256-GCM en `core/utils/crypto.ts`. Alta (`POST /time-clock/clocks`) y edición (`PATCH /time-clock/clocks/:serial`) aceptan `username`/`password` write-only; las respuestas solo traen `username` y `hasCredentials` (nunca la contraseña) y el alta conecta antes de guardar. Los seis servicios de reloj (service, roster, inspect, people, summary, employees vía service) resuelven las credenciales por reloj con fallback al par del `.env`; el 503 `TIME_CLOCK_NOT_CONFIGURED` queda solo cuando no hay ni credenciales del reloj ni del `.env`, y `POST /time-clock/sync` responde 502 `TIME_CLOCK_INVALID_CREDENTIALS` al instante si el equipo rechaza las del reloj. Backfill: los relojes ya dados de alta siguen con el par global hasta que se editen (no hay ventana de fallo desde SQL). Docs: `docs/modules/time-clock.md` y `api/.env.example`. Pruebas: unit de `crypto` y `clock-credentials`; integración `clock-credentials.flow.test.ts` (6 casos, reloj → mock ISAPI: alta con credenciales incorrectas 502, alta correcta, cifrado en BD, edición write-only, sync correcto y sync con contraseña incorrecta 502). Suites auth/personal/tenancy + nueva: **49/49** en `tm_test`. Sin commit.
- [x] **F1B-11 Agente desktop on-prem por cliente (A4 cerrada).** En cada sitio se instala una app de escritorio (modelo `~/DEV/PTNV/AXZY_PTNV_SERVERS/agente`: Electron + instaladores .exe/.AppImage) que: se registra contra la nube con una credencial de cliente, abre conexión saliente, descarga su configuración de relojes, corre la sync desde la LAN y ejecuta las escrituras (padrón, tarjetas, huellas) y la estación cuando aplica. El API/workers en la nube siguen siendo la fuente de verdad; el agente es el "brazo" en el sitio. Archivos: repo del agente (nuevo), `api/src/workers/*` (modo `--edge` reutilizando servicios), docs/despliegue. **Parcial: el MVP del agente ya vive en `agent/` (F1B-14..17); quedan el modo edge/estación y el despliegue.**
- [x] **F1B-13 Ingesta y cola de trabajos del agente.** `GET /agent/config`, `POST /agent/punches` (lote idempotente por `@@unique(clockSerial, serialNo)`, cursor monótono y `TimeClockSyncEvent` con trigger `AGENT`), `GET /agent/jobs` + `POST /agent/jobs/:id/result` (estado y reintentos con backoff) y `POST /agent/heartbeat` (salud del último sync). Todo bajo `authenticateAgent` (token de dispositivo por cliente, contexto `runWithTenant`). Pruebas: `api/tests/integration/agent.flow.test.ts` (17 casos) en `tm_test_agent`.
- [x] **F1B-14 Agente Electron (MVP).** Paquete nuevo `agent/` del monorepo (`timemanager-agent`): Electron 44 + Vite 6 + React 19 con `@axzydev/axzy_ui_system` y tema TimeManager. UI: estado del agente y de cada reloj, cola pendiente, logs exportables, "Sincronizar ahora", "Probar reloj", rotar token, config (URL del API, token write-only, chunk 15–30 s, arranque con el sistema). Servicio en el main process con ciclo leer ISAPI → cola en disco → subir chunks → jobs → heartbeat y cola local persistente; `safeStorage` para el token. electron-builder: NSIS x64 + AppImage (icono incluido). `tsc --noEmit && vite build` OK.
- [x] **F1B-15 Ingesta de checadas del agente.** `POST /agent/punches` + `GET /agent/config`: los relojes activos viajan con sus credenciales descifradas solo para el agente autenticado; el agente sube chunks cada 15–30 s configurables (default 20) y mantiene cola local (`queue.json`) para reintentar sin pérdida ni duplicados (idempotencia y cursor del lado del API).
- [x] **F1B-16 Cola de trabajos para el agente.** Modelo `AgentJob` + interfaz `AgentJobQueue` con implementación `TableAgentJobQueue` (lista para sustituirse por pg-boss cuando entre A1): tipos `SYNC`, `PERSON_ADD`, `PERSON_REMOVE`, `CARD_ADD`, `CARD_REMOVE`, `FINGERPRINT_APPLY`; claim atómico (compare-and-set), estados `PENDING/RUNNING/DONE/FAILED/CANCELLED`, `attempts`/`maxAttempts`, reintentos con backoff 5 s…5 min, trabajos dirigidos por `agentId` y auditoría del resultado. El agente los ejecuta con ISAPI (`agent/electron/isapi.cjs`).
- [x] **F1B-17 Credenciales de agente.** `Agent` por cliente con `tokenHash` SHA-256 (el token en claro solo se muestra al emitir/rotar), `version`, `active` revocable y `lastSeenAt`/`lastSyncAt`; `POST /agent/token` rota el token e invalida el anterior; middleware propio (401 `INVALID_AGENT_TOKEN`, 403 `TENANT_SUSPENDED`) y auditoría de registro/rotación (`AGENT_REGISTER`, `AGENT_TOKEN_ROTATE`, resultados de trabajos). Migración a mano `20261107000000_agent`. Consola de alta/rotación/revocación en F3-12. **Riesgo abierto:** con `RLS_ENABLED=true`, el lookup por `tokenHash` (y el login de usuarios) ocurre antes del contexto de tenant; el dueño de RLS debe darle bypass.
- [x] **F1B-12 Estación de huellas configurable (central o en sitio).** Modelo `FingerprintStationConfig` con una fila por alcance: `tenantId = null` = estación central de plataforma, fila con `tenantId` = override del cliente (estación en su sitio). La captura resuelve en cada uso: override del cliente → central → `FINGERPRINT_STATION_*` del `.env` (fallback). API solo de plataforma (`time_clocks.manage` + usuario sin cliente): `GET/PUT /time-clock/fingerprint-station/config` (la contraseña se guarda cifrada AES-256-GCM y **nunca** se devuelve, solo `hasPassword`/`source`; `clear` borra el scope). El cliente ve su estación efectiva en `GET /time-clock/fingerprint-station` y el enrolamiento usa la misma lógica para central o en sitio. Pruebas: unit del servicio (precedencia/cifrado) + integración `platform-config.flow.test.ts`. Pendiente: pantalla de plataforma para editar la config (hoy por API).
- [x] **F1B-09 Aislamiento probado en los flujos, no solo en la capa Prisma.** Cerradas dos fugas entre clientes: los `$queryRaw` de checadas/relojes ahora filtran por el tenant del contexto (`time-clock-employees.service.ts`, `time-clock-report.service.ts`) y la extensión cubre `findUniqueOrThrow`/`findFirstOrThrow` (antes `GET /users/:id` leía expedientes de otro cliente). Regresión: `api/tests/integration/tenancy.flow.test.ts` (13 casos) + unit de `scopeArgs`.

### Fase 1c — Cierre de seguridad y artefacto desplegable (bloquea vender)

> Artefacto y CI cerrados: `web/nginx.conf` + `render-config.sh` (config runtime por `API_URL`), imagen web con `build:prod`, CI en `.github/workflows/ci.yml` (quality, integración con Postgres, build de ambas imágenes y E2E manual). Workflows heredados de Puerto Nuevo eliminados.

Sale de la auditoría de runtime y despliegue del 2026-11-04. No depende de decisiones de planes ni de NOM: son huecos de seguridad de datos y la falta de un artefacto que se pueda desplegar de verdad.

- [x] **F1C-01 Foto y archivos personales privados.** `GET /api/v1/hr/:id/photo/raw` deja de ser público: la credencial es un JWT de propósito `photo` y vida corta (5 min, `sub` = dueño) que va en `?token=` y se emite al armar `photoUrl` en `auth/me`, `access/lookup`, la ficha de RH y el upload; el endpoint valida firma/expiración/propósito y `sub === :id` (401/403). S3 ya no produce URLs públicas: `publicObjectUrl` se eliminó y los documentos usan `signedObjectUrl` (GET presignado, 10 min) o el proxy del API; **el bucket debe quedar privado** (cambio de infraestructura documentado en `docs/modules/hr.md`). La web resuelve la ruta firmada con `resolvePhotoUrl` (`entities/hr`). Regresión: `api/tests/integration/photo.flow.test.ts` (6) + `api/src/core/utils/security.photo.test.ts` (6). Archivos: `api/src/modules/api.router.ts`, `api/src/core/services/storage.ts`, `api/src/core/utils/security.ts`, `api/src/modules/hr/*`, `api/src/modules/auth/mappers/auth.mapper.ts`, `api/src/modules/access/services/access.service.ts`, `web/src/entities/hr/**`, `web/src/features/hr/employee-detail/ui/EmployeeHero.tsx`, `web/src/pages/employees/EmployeeProfileEditPage.tsx`, `web/src/features/user/employees-list/ui/EmployeesTable.tsx`, `web/src/widgets/employee-credential/model/useEmployeeCredential.ts`.
- [x] **F1C-02 Ably por token, no por key en el bundle.** `GET /notifications/ably-token` (solo `authenticate`, sin permiso extra) emite un `TokenRequest` firmado en el servidor con `env.ABLY_API_KEY`: `clientId` del usuario, capability `{ "user:<id>": ["subscribe"] }` y TTL 1 h; sin key o si el SDK falla → 503 `ABLY_NOT_CONFIGURED`/`ABLY_TOKEN_FAILED`. La web (`web/src/shared/lib/ably.ts`) ya no usa `key` ni `VITE_ABLY_API_KEY` (quitada de `web/.env.example`, `vite-env.d.ts` y del build-arg del Dockerfile): usa `authCallback` autenticado + `clientId` y, si el API responde 503, se queda sin notificaciones en vivo sin romper la app. Fuera `broadcastTicketEvent`/`broadcastDashboardEvent` y el canal `dashboard` (L-10 parcial). Regresión: `api/tests/integration/ably.flow.test.ts` (5) + unit de `ably-token.service` (5). **Falta rotar la key vigente en el panel de Ably (L-20, acción del usuario).**
- [x] **F1C-03 API lista para producción.** `compression`; rate limit en `/auth/login` y en los `/query` (store en memoria hoy, Redis en F1B-03); `trust proxy`; no escribir un `audit_log` por cada 403 sin freno; `SIGTERM` + `$disconnect` con cierre ordenado; imagen sin devDependencies, usuario no root y `HEALTHCHECK`. Archivos: `api/src/app.ts`, `api/src/index.ts`, `api/Dockerfile`.
  - Implementado: `app.ts` (compression, `BODY_LIMIT`, `TRUST_PROXY`, rate limit login/query, request-id, `/metrics`) y `production.middleware.ts`; `index.ts` con apagado ordenado (`SIGTERM`/`SIGINT`, cierre del server, stop de workers, `$disconnect`); `audit_log` de 403 frenado a 1 por usuario+permiso+ruta cada 60 s; `Dockerfile` multi-stage con dependencias de producción, `USER node`, `HEALTHCHECK` y migración fuera del CMD (paso de release). Guía: `docs/OPERACION_PRODUCCION.md` §5.
- [x] **F1C-04 Artefacto desplegable y CI.** Crear `web/nginx.conf` + `web/render-config.sh` (L-05) con gzip, cache inmutable y fallback SPA; que la imagen web use `build:prod` (hoy `build:image` compila en modo development); servir o eliminar `/config.js`; CI en la raíz (F4-06) con typecheck, lint, unit, integración y build de ambas imágenes; sacar `prisma migrate deploy` del `CMD` y correrlo como paso de release. Archivos: `web/Dockerfile`, `web/nginx.conf`, `web/render-config.sh`, `.github/workflows/*`, `api/Dockerfile`.
- [x] **F1C-05 Endpoints caros con techo.** `GET /users/employees` con paginación y sin traer 4 relaciones de toda la tabla; `weekly-attendance` deja de cargar `limit: 100000` por request (precalcular o paginar; el dashboard la llama dos veces); `/time-clock/dashboard` sin `await` secuencial por reloj. Archivos: `api/src/modules/users/*`, `api/src/modules/schedules/services/weekly-attendance.service.ts`, `api/src/modules/time-clock/services/time-clock-summary.service.ts`.
  - Implementado: `/users/employees` filtra en la BD con tope (500; `?limit=` hasta 500) y trae 2 relaciones en vez de 4; `weekly-attendance` pide el tope de tabla (el cálculo no pagina) y cachea 30 s por tenant (el dashboard lo llama 2 veces); el resumen de relojes lee en paralelo (`Promise.all`) reloj + último sync + checadas del día. La materialización nocturna de asistencia queda como siguiente paso de F1B-03.
- [x] **F1C-06 Documentación y entorno al día.** `api/.env.example` no tiene `JWT_SECRET` ni `ABLY_API_KEY` (la API no arranca con él), falta `web/.env.example` y los docs dicen 36 modelos cuando son 37. Criterio: un clon limpio arranca siguiendo los `.env.example`.

### Fase 2 — Requisitos NOM (antes de vender "cumple NOM")

- [x] **F2-01 Inmutabilidad de checadas + ajustes.** `time_clock_punches` y `access_events` son append-only por trigger de BD (migración `20261107000000_nom_immutability`): el UPDATE/DELETE falla; la única purga es el archivado por retención con `SET LOCAL app.nom_purge='on'`. Las correcciones son `PunchAdjustment` (motivo, quién/cuándo, `previousState`/`newState`, aprobador; no se aprueba el propio ajuste) y el valor vigente se calcula en `GET /nom/punches/:id/history` sin tocar la checada. Flujo del trabajador por API (`/nom/me/punches`, `/nom/me/discrepancies`); falta pantalla web. Regresión: `api/tests/integration/nom.flow.test.ts` + unit `nom.logic.test.ts`.
- [x] **F2-02 Auditoría de correcciones y OT.** Cada solicitud/decisión de ajuste, cada decisión de OT (`OVERTIME_APPROVAL_DECISION` con estado anterior/nuevo por persona y día), la config NOM, las alertas y el archivado escriben en `audit_logs`; `GET /audit` acepta `entityId` y el historial por checada incluye la pista completa.
- [x] **F2-03 Límites legales de jornada con alertas.** Config por cliente en `nom_settings` (default `sys_config`/legal): 12 h/día (720 min) y tope semanal por año (46 h 2027-2029 → 40 h desde 2030, `weeklyLimitForYear`). Barrido horario con el cálculo de `schedules` (`computeOvertimeDays`), alerta idempotente `WorkdayLimitAlert` y aviso a RH por campanita + correo; worker `startNomWorker` y `POST /nom/alerts/scan`.
- [x] **F2-04 Retención configurable + archivado.** Meses por cliente en `nom_settings` (default `sys_config.NOM_RETENTION_MONTHS`); mueve checadas y eventos de acceso vencidos a `nom_archived_*` en transacción todo-o-nada (INSERT/SELECT + DELETE con purga controlada), worker diario, `POST /nom/retention/archive` (con `dryRun`) y comando `api/scripts/nom-archive.ts`. Falta validar el plazo legal con asesor (F2-06).
- [x] **F2-01..04 docs y criterio legal.** Checklist técnico mapeado en `docs/NOM_CUMPLIMIENTO.md`; la precisión legal es LFT art. 132 fr. XXXIV (no NOM-037, que es teletrabajo). **Pendiente legal (F2-06):** formato oficial STPS, retención definitiva y aviso de privacidad/consentimiento.
- [x] **F2-05 Retardo mal calculado (DEMO-911, "Retardo 5:59 h").** La causa estaba antes del cálculo: `scheduleOn` resolvía la asignación vigente **más antigua**, así que con vigencias encimadas (una reasignación/corrección hacia atrás que no cerró a la anterior) la checada de las 14:58 se comparaba contra un Matutino 09:00 → 359 min ≈ "5:59 h", en vez del Vespertino 15:00 que sí estaba asignado (0 min). Ahora gana la asignación que **entró en vigor al final** del día (empate: la capturada después y el id); asistencia, pre-nómina y horas extra siguen usando el mismo `computeWorkday`. Regresión: unit `workday-rules.test.ts` (DEMO-911, retardo en minutos, día de descanso, sin horario y turno nocturno) e integración `tests/integration/schedules-late.flow.test.ts` (reporte semanal + Entradas y salidas). Archivo: `api/src/modules/schedules/services/schedule-assignments.ts`.
- [ ] **F2-06** Validar requisitos STPS (formato, retención, integridad) con asesor legal.
- [x] **F2-07 Marcaje remoto y portal del trabajador.** `POST /nom/me/punch` para home office/campo sin reloj: hora del servidor, idempotente por `clientEventId`, secuencia ENTRY/EXIT validada, geolocalización **opcional y solo en el marcaje** (sin rastreo continuo) e interruptor por cliente (`remotePunchEnabled`). Modelo `RemotePunch` append-only (trigger) incluido en `/nom/me/punches`, export STPS (sección sin coordenadas) y retención/archivado. Portal web del trabajador en `/mi-jornada` (marcar, marcajes, reportar discrepancia, teletrabajo). Regresión: `nom.flow.test.ts`.
- [x] **F2-08 NOM-037 teletrabajo + aviso de privacidad.** Registro de teletrabajadores por cliente (`TeleworkRegistration`, alta/baja/reactivación), política de teletrabajo/desconexión y aviso de privacidad editables por cliente con versiones y consentimiento del trabajador, checklist inicial/periódico del lugar (`TeleworkChecklist`, 8 puntos, validado en API), y comunicaciones fuera de jornada (`OutOfHoursContact` + aviso in-app). Administración en `/teletrabajo`. **Validación legal del texto/plazo queda fuera (F2-06).**

### Fase 3 — Consola de plataforma y onboarding

- [x] **F3-01** Consola de plataforma (web, solo ADMIN/SUPPORT): lista de clientes, plan, estado, uso (empleados activos, checadas/día, relojes).
  - Implementado en `/` sin cliente elegido (`pages/home/PlatformHomePage`, `features/tenant/tenants-console`): totales, búsqueda y filtro por estado, subdominio, personas activas y relojes contra su límite, plan, alta, **Entrar** (opera como el cliente) y **Suspender/Reactivar** con confirmación. Falta en uso: checadas/día.
- [x] **F3-02** Alta de cliente guiada: tenant + `CLIENT_ADMIN` + catálogos plantilla + correo de bienvenida.
  - Hecho: correo de bienvenida al `CLIENT_ADMIN` (`tenantWelcomeEmail`) con su entrada, usuario, contraseña provisional y primeros pasos; el diálogo avisa si se envió.
  - Hecho: diálogo "Nuevo cliente" (subdominio sugerido desde el nombre, zona horaria, límite, plan, administrador) que al terminar muestra entrada, usuario y contraseña provisional una sola vez, con botón de copiar. Falta: correo de bienvenida.
- [ ] **F3-03** "Entrar como cliente" para soporte, con auditoría.
- [x] **F3-04** Límites por plan (`employeeLimit`, relojes) aplicados en altas y en la consola. → F3-09/10/11.
- [x] **F3-09 Catálogo de planes y límites.** Modelo `Plan` (`key`, nombre, `employeeLimit`, `clockLimit`, `monthlyPrice`, `active`, `sortOrder`), `Tenant.planId` como FK con **backfill** del `plan` de texto y baja de la columna vieja; migración SQL a mano (`20261107000100_plans` + rollback) y seed con 500/750/1000 personas, 1/2/3 relojes y precios 500/750/1000. API CRUD solo de plataforma (`plans.view` / `plans.manage`) y asignación en `PATCH /tenants/:id`. Consola web en `/plans` (listado, alta/edición y baja/reactivación) y selector de plan en el alta de cliente. Ficha: [modules/plans.md](modules/plans.md).
- [x] **F3-10 Enforcement del límite.** Helpers `assertCanAddPeople` / `assertCanAddClock` (`api/src/core/plans/limits.ts`) aplicados en alta individual, importación Excel, onboarding del `CLIENT_ADMIN` y alta de reloj, con errores i18n que muestran uso y límite (409 `EMPLOYEE_LIMIT_REACHED` / `CLOCK_LIMIT_REACHED`). Dar de baja libera lugar; bajar de plan no borra datos. Regresión: `api/tests/integration/plans.flow.test.ts`.
- [x] **F3-11 Consola de planes en la ficha del cliente.** La consola de clientes muestra personas y relojes contra su límite (en rojo si el uso lo rebasa), el nombre del plan y un diálogo **Plan** con selector, uso actual y aviso de exceso; el alta de cliente elige plan.
- [x] **F3-05 Branding por cliente (parcial).** `Tenant` gana `brandColor` (`#RRGGBB`), `logoDataUrl` (data URL PNG/JPEG/WebP) y `emailFrom`; se editan con `PATCH /tenants/:id` (plataforma, auditado con valor anterior/nuevo) y `/auth/me` los expone en `tenant`. Login público: `GET /auth/branding?tenant=<slug>` (sin sesión) y la web aplica logo/color/nombre en el panel de login y el logo/nombre en el sidebar. **Pendiente:** aplicar color/logo a PDFs y plantillas de correo (hoy usan la marca TimeManager) y usar `emailFrom` como remitente por cliente en la cola (fallback `RESEND_FROM_EMAIL`); el dominio debe estar verificado en Resend.
- [ ] **F3-06** Subdominios en producción (DNS wildcard + certificado wildcard).
- [x] **F3-07 Aprovisionamiento guiado del reloj del cliente (panel de relojes).** El detalle del reloj (`ClockDetail`) agrega **“Probar conexión”** (usa `GET /time-clock/clocks/:serial/inspect/overview`, la misma ruta de inspección; muestra serial conectado o el error) y **“Sincronizar ahora”** (`POST /time-clock/sync`, misma ruta del worker, con refresco de estado); el **último sync** ya se mostraba (`syncedAt`, cursor y checadas). El panel del agente local ya encola `SYNC`/altas/bajas (`POST /agent/jobs`). Sin rutas nuevas: no se duplicó nada. Falta llevar este bloque a la consola de plataforma (hoy vive en la pantalla de relojes del cliente).
- [ ] **F3-07 Plataforma: aprovisionamiento guiado en la consola de plataforma.** En la consola de plataforma: alta del equipo (serial, nombre, URL/LAN, usuario y contraseña, habilitar escritura), botón "Probar conexión", "Sincronizar ahora" y estado del último sync. Requiere F1B-10 y F1B-11; es el paso que se repite con cada cliente nuevo. **Parcial (F3-12):** el panel de relojes ya tiene la tarjeta "Trabajos para el agente local" que encola altas/bajas de personas y tarjetas (`POST /agent/jobs`) y muestra los últimos trabajos; el alta del reloj con "Probar conexión" ya existía en la pantalla de relojes del cliente. Falta llevar el aprovisionamiento a la consola de plataforma.
- [x] **F3-12 Puesta en marcha del agente por cliente.** Consola de plataforma con botón **Agente** por cliente (`AgentTokenDialog`): lista agentes, crea y muestra el token de dispositivo una sola vez (`createAgentToken()`), rota el token, revoca/reactiva y muestra versión/último contacto. API: `GET/POST /agent/agents`, `POST /agent/agents/:id/token`, `PATCH /agent/agents/:id` (solo personal de plataforma, `tenants.manage` o `time_clocks.manage`, auditado). Junto con F3-07, el panel de relojes encola `SYNC`/`PERSON_ADD`/`PERSON_REMOVE`/`CARD_ADD` vía `POST /agent/jobs`. Falta el checklist de red/instalador dentro de la consola (hoy en `agent/README.md`). Pruebas: `agent.flow.test.ts` (25), incluye alta/rotación/revocación desde consola y permisos.

### Fase 4 — Operación SaaS

- [ ] **F4-01** Cobro (según D5): suscripción por empleado activo/mes.
- [ ] **F4-02** Rate limiting por IP y por cliente; `compression`; paginación por cursor en todos los `/query`.
  - Implementado: rate limit (login/query, en memoria) y `compression`; **cursor server-side** opaco (`encodeCursor`/`decodeCursor`) compatible con offset y `limit` máximo (200) en checadas (`/time-clock/query`), usuarios (`/users/query`) y acceso (`/access/query`): sin `cursor` la respuesta es la de siempre y anuncia `nextCursor`; con `cursor` no paga COUNT y no repite filas. Test `cursor.flow.test.ts`. Pendiente: el resto de `/query` y rate limit por cliente (hoy por IP).
- [x] **F4-03** Observabilidad: request-id, métricas (latencia por ruta, profundidad de cola), alertas.
  - Implementado: `core/observability/{request-context,metrics}.ts`, request-id de correlación (header y logs JSON con tenant/user), `prom-client` con latencia por ruta/estado, 5xx, `queue_depth` (correo + pg-boss) y `worker_leader`; `GET /metrics` y `/api/v1/metrics` protegidos con `METRICS_TOKEN` o JWT ADMIN/SUPPORT; alertas sugeridas en `docs/OPERACION_PRODUCCION.md` §6.
- [ ] **F4-04** Backups y restore **por cliente** ensayado.
- [ ] **F4-05** Prueba de carga con k6: 5,000 checadas en 10 min + dashboards concurrentes.
- [x] **F4-06** CI en la raíz (`.github/workflows`): typecheck, lint, unit, build de imágenes **con nombre TimeManager**.
- [x] **F4-07 Pruebas de integración de flujos.** Arnés propio (`api/tests/integration/harness.ts`): API real con `createApp` contra Postgres 16 en Docker, arranque por archivo con BD limpia (truncate + siembra de roles/permisos/matriz/políticas) y sesiones por rol. 43 casos: sesión/login/refresh/cambio de contraseña (14), Personal y seguridad de roles (16), aislamiento entre clientes y regresión de las fugas (13). Comandos: `pnpm db:test:up` + `pnpm test:integration` (el arnés se niega a correr contra cualquier BD que no sea local `tm_test*`).

### Fase 5 — Enterprise (cuando lo pida un cliente)

- [ ] **F5-01** SSO (SAML/OIDC).
- [ ] **F5-02** BD dedicada por cliente (exportar su slice).
- [ ] **F5-03** SLA y residencia de datos.

### Limpieza heredada (paralelizable, en cualquier momento)

- [x] **L-01** `notificationRoute` en `web/src/entities/notification/model/types.ts` aún apunta a `/tickets`, `/inventory`, `/kitchen`.
- [ ] **L-02** Borrar carpetas vacías del API: `inventory`, `kitchen`, `tickets`, `hotel-store`, `material-outputs`, `reports`, `suppliers`.
- [x] **L-03** Políticas ABAC de órdenes de compra/facturas en `api/src/core/policies/seed.ts` (residuo del ERP). Retiradas en L-03: `DEFAULT_POLICIES` queda vacío (el producto no trae reglas de fábrica); el catálogo de acciones y el motor ABAC siguen disponibles para la consola de roles. Las filas de política que ya existieran en una BD no se borran por seed (insert-missing).
- [x] **L-04** `api/.github` y `web/.github` publican imágenes `axzydev/axzy_ptnv_*` (Puerto Nuevo): borrarlos y crear CI propio en F4-06. **No moverlos a la raíz.**
- [x] **L-05** `web/Dockerfile` copia `nginx.conf` y `render-config.sh`, que no existen en el repo.
- [x] **L-06** `web/docs/MODULES.md` desactualizado (rutas y componentes que ya no existen). Reescrito al producto actual: rutas reales (Personal, mi jornada/teletrabajo, roles, planes, reloj, horarios), entidades/features/widgets reales y sin tickets/inventario/cocina/kanban.
- [x] **L-07** Catálogos `Gender`/`BloodType` son de plataforma: quitarle `catalogs.manage` sobre ellos a `CLIENT_ADMIN`. Hecho en `api/prisma/seed-data/role_permissions.json` (solo ADMIN conserva `catalogs.manage`); la matriz se siembra insert-missing, así que un `CLIENT_ADMIN` existente conserva su fila hasta el siguiente `pnpm cutover`/reseed. Sin tests que asumieran ese permiso; la web deja el catálogo de documentos en solo lectura para quien no tiene la clave.
- [x] **L-08** Enums huérfanos del ERP sin modelos ni referencias: `MaterialOutputReason`, `DeviceUnitStatus`, `MovementType`, `MovementStatus`, `LoanStatus`, `ItemCondition`, `TicketStatus`, `TicketPriority`, `AssignmentStatus` (borrados del schema).
- [x] **L-09** `User.company` (texto libre, muere con D2 en favor de `tenantId`): borrado del schema, DTOs/entities/mappers/services de `users` y `hr`, y de la web (hero, tipos). La migración F1A-02 debe incluir el `DROP COLUMN`.
- [x] **L-10** `Notification.ticketId` + canal Ably `tickets:` + referencias en `appEvents`, `useAblyNotifications` y DTO de `dashboard` (residuo de tickets). Cerrado: se quitó `Notification.ticketId` (schema, DTO, entity y tipos web `Notification`/`LiveNotification`), los eventos de ticket/tarea de `appEvents` y los grupos `tickets`/`custodyLetters`/ticket-metrics del DTO y del tipo web de `dashboard`. Migración `20261110000000_legacy_cleanup`. Los publicadores y el canal de Ably ya se habían quitado en F1C-02.
- [x] **L-11** `AuditLog.deviceId`/`deviceCode` (residuo del audit de inventario): DTO/entity/mapper de `audit` + writers del `AuditLogger`. Cerrado: columnas fuera (schema + migración `20261110000000_legacy_cleanup`), DTO/entity y filtro `deviceId` de `GET /audit` fuera, y el writer de `access` guarda el dispositivo en `metadata` del log (el dispositivo del evento sigue en `access_events`).
- [x] **L-18** Personal y Usuarios en una sola pantalla (Personal): una persona = una cuenta. Acciones de cuenta en un menú "⋯" por fila, lista por permiso (expediente o cuentas), `/users/*` redirige. Se cerró una escalada: un `CLIENT_ADMIN` podía dar ADMIN/SUPPORT (roles de plataforma) a su personal; ahora el API lo rechaza (`ROLE_NOT_FOR_CLIENT`) y la web no los ofrece. En Railway no había ningún caso.
- [x] **L-21 Residuo de tickets/tasks del ERP (pedido como "L-13" en el encargo; el id L-13 ya era de la mascota Tic).** Fuera de la web el filtro "tickets" de Notificaciones, la familia/mosaicos de tickets e inventario del Historial de cuenta, las tarjetas/link `/tickets/:id` de la Actividad del empleado y los widgets muertos del cliente de dashboard (`DashboardSummary`, tickets/tasks/my-equipment/access-today/system-health). `EmployeeActivity` llamaba `GET /hr/:id/overview` (404): se implementó el endpoint (`hr.records`, tenant-scoped) con documentos cargados/faltantes, checadas de 30 días, actas de 12 meses y horario vigente; la pestaña se rediseñó a esos datos. Además: `POLICY_ACTIONS` del ERP vaciado (`purchase_orders.*`/`invoices.register`; el enum de Swagger pasa a `z.string()` y la consola oculta "Nueva política" sin acciones), fuera `DepartmentCustodyLetter`/`custodyLetters` (DTO y tipo web) y el namespace i18n `custody-letters`, y DTO `DashboardSummary` del ERP (devices/materialOutputs/inventory) retirado. Regresión: `api/tests/integration/hr-overview.flow.test.ts` (5).
- [ ] **L-20 Rotar la key de Ably.** La app key estuvo hardcodeada en `web/src/shared/lib/ably.ts` desde el primer commit (historial de git) y viajó en el bundle. Ya no se usa en la web (F1C-02: el API emite tokens con capability de solo suscribir `user:<id>`); **falta rotarla en el panel de Ably**, porque la key vieja sigue en el historial de git y en `api/.env`.
- [ ] **F1A-12 Defensa en profundidad de rutas de plataforma.** `roles.manage` (matriz global), `system.configure` (`sys_config` global) y la consola de roles deberían exigir además usuario de plataforma, como `/tenants`.
- [x] **L-17** Correos: marca TimeManager (colores, logo PNG, remitente, textos sin "Puerto Nuevo"/"Cartas Responsivas", `charset=utf-8`), nombre del cliente en encabezado y asunto, botón de entrada por subdominio y avisos de RH dentro del cliente (ya no a la lista global). Fuera las plantillas de tickets, tareas y órdenes de compra. Pendiente del usuario: verificar `axzy.dev` en Resend (hoy 403).
- [x] **L-14** Un solo indicador de carga: el esqueleto de `ITPage`. Página completa → `<ITPage loading>`; bloque dentro de página o diálogo → `ContentSkeleton` (`shared/ui/content-skeleton`, mismo esqueleto). Fuera `LottieLoader`, el `ITLoader` de contenido y `TicState kind="loading"` (20 pantallas). Los botones conservan su `loading`.
- [x] **L-15** Inicio del cliente (`/`, `features/home/client-overview`): primeros pasos (personal, horarios, asignación, reloj), asistencia de hoy, personal, expedientes, tiempo extra de la semana y pendientes de configuración; cada bloque según permiso y con su propio esqueleto/error. Antes `/` mandaba a `/employees`.
- [x] **L-16** `PanelCard` apilaba título y descripción en fila (se veían pegados en todas las tarjetas); el logo de la barra superior repetía "TimeManager".
- [x] **L-13** Mascota: Langostín (Puerto Nuevo) reemplazada por **Tic** en toda la web (`shared/ui/tic`, `tic-chat`, `tic-confirm`, namespace i18n `tic`); fuera la entrada muerta de la galería del menú, los namespaces i18n sin uso `tickets`/`inventory`/`home` y los textos "Puerto Nuevo" visibles (departamentos, pre nómina, credencial).
- [x] **L-12** `DepartmentTicketSchema` en el DTO de `departments` y grupo `tickets` en el DTO de `dashboard`. Cerrado: fuera el schema/registro y los campos `tickets`/`ticketsTotal` de `DepartmentSchema` (API y tipo web), y fuera el grupo `tickets` del DTO de `dashboard`.

---

## 5. Reglas de trabajo

- **Monorepo**: `pnpm install` desde la raíz; un solo `pnpm-lock.yaml`.
- **Migraciones**: SQL a mano con backfill; nunca `migrate dev` contra la BD de la nube ni `DATABASE_URL` como shadow. `pnpm cutover` es destructivo: solo si se pide.
- **QA por tarea**: `pnpm typecheck`, `pnpm lint`, pruebas del módulo. Sin E2E salvo petición.
- **Datos sensibles**: checadas, geolocalización y biometría son datos personales sensibles (cifrado, acceso por rol, consentimiento).
- **Docs**: cada cambio de módulo actualiza `docs/modules/<modulo>.md` y este plan.
- **Puerto Nuevo**: este repo no publica ni despliega nada de Puerto Nuevo.

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Fuga de datos entre clientes por una consulta sin filtro | Extensión Prisma (F1A-03) + RLS (F1B-01) + `tenancy-check` en CI |
| Escrituras anidadas sin `tenantId` | Default de BD que falla ruidosamente + revisión en F1A-05 |
| Workers duplicados con 2+ réplicas | F1B-02 antes de escalar réplicas |
| Pico de checadas a la hora de entrada | Cola de ingesta (F1B-03), índices (F1B-08), prueba k6 (F4-05) |
| Requisitos STPS sin publicar | F2-06 antes de prometer cumplimiento |
| Conexiones de Postgres agotadas | PgBouncer (F1B-07), decisión A2 |

---

## 7. Próximos sprints (orden recomendado)

Los IDs mandan; esto solo agrupa lo que se trabaja junto.

| Sprint | Tareas | Sale con |
|---|---|---|
| **S1 — Seguridad** (2-3 días) | F1C-01, F1C-02, F1C-06 | Ninguna foto o documento accesible sin sesión; Ably por token; integración en verde |
| **S2 — Artefacto** (2-3 días) | F1C-04, F4-06 | `docker build` de API y web OK; CI en la raíz verde; deploy a staging reproducible |
| **S3 — Capacidad** (1-2 semanas) | F1B-02, F1B-07, F1C-03, F1C-05, F4-05 | k6 con p95 < 500 ms; 2 réplicas sin workers duplicados ni caches viejas |
| **S4 — Relojes por cliente** (1-2 semanas) | F1B-10, F1B-11, F1B-12, F3-07 | Se instala un reloj en casa del cliente y el API lo sincroniza con SUS credenciales; alta guiada y estación de huellas nuestra |
| **S5 — NOM y negocio** | F2-01…F2-06, D5, F3-04 | Expediente NOM vendible y planes aplicados en alta |

Decisiones que necesito del equipo para no bloquear: A1 (cola BullMQ vs pg-boss), A2 (plan y límites de Postgres en Railway), D5 (modelo de cobro), A3 (dominio de producción) y si el cliente actual migra como tenant #1.
