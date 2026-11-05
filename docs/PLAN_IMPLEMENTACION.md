# Plan de implementación — TimeManager SaaS

Roadmap **ejecutable** para convertir TimeManager en una plataforma de renta de checadas multi-cliente. Cada tarea tiene un ID, archivos, criterio de "hecho" y pruebas, para trabajarla en una sesión o PR propio.

- El **porqué** de cada decisión vive en [SAAS_PLAN.md](SAAS_PLAN.md) (tenancy, identidad, planes) y [ARQUITECTURA.md](ARQUITECTURA.md) (escala, colas, BD, web).
- Este archivo es el **qué y en qué orden**. Al terminar una tarea, se marca `[x]` aquí en el mismo commit.

Última actualización: 2026-11-04.

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
| D5 | Planes y cobro (por empleado activo/mes; Stripe vs Conekta vs manual) | **Abierta** |
| A1 | Cola: BullMQ + Redis vs pg-boss (sin Redis) | **Abierta** — ver ARQUITECTURA §6 |
| A2 | Proveedor de Postgres (límites de conexiones, PgBouncer, réplicas) | **Abierta** |
| A3 | Dominio de producción (`timemanager.mx`?) | **Abierta** |

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

- [ ] **F1A-05 Servicios y workers.**
  - Reemplazar `findUnique` por campos que dejaron de ser únicos (`username`, `name`, `key`, `url`, `weekStart`, `employeeNumber`) por su único compuesto o `findFirst`.
  - Creaciones anidadas (`create: { … }` dentro de otro `create`) de modelos de cliente: pasar `tenantId: requireTenantId()` explícito (la extensión no entra a escrituras anidadas).
  - Workers (`startTimeClockWorker`, padrón/roster, cola de correo): iterar clientes `ACTIVE` y correr cada ciclo dentro de `runWithTenant(t.id, …)`.
  - Caches en memoria con datos de cliente: indexarlas por `tenantId` o eliminarlas.
  - Seed: `seedPermissionsFromFixtures` sigue siendo de plataforma; `RemovalCategory`/`DocumentType` plantilla se copian al crear un cliente.

- [ ] **F1A-06 Endpoint de clientes (mínimo).** Módulo `tenants`: `GET /tenants` (ADMIN/SUPPORT), `POST /tenants` (ADMIN: crea tenant + su `CLIENT_ADMIN` + catálogos plantilla), `PATCH /tenants/:id` (estado). Ficha `docs/modules/tenants.md`.

- [ ] **F1A-07 Web.**
  - Login: slug desde el subdominio (`acme.localhost:5006` en local; `*.localhost` resuelve sin DNS). `app.`, `admin.` o sin subdominio = plataforma. Vite: `server.allowedHosts` con `.localhost`.
  - Selector de cliente en la barra superior para `ADMIN`/`SUPPORT` que manda `X-Tenant-Id` (interceptor axios) y recuerda la elección en `localStorage`.
  - Nombre del cliente visible en la barra superior.
  - Archivos: `web/src/features/auth/login`, `web/src/shared/api`, `web/src/app/guards/PrivateRoutes.tsx`.

- [ ] **F1A-08 Pruebas.**
  - Agregar `pnpm test:unit` al API (runner `node:test` + `ts-node`, sin BD).
  - Unitarias de `scopeArgs`: cada operación agrega el filtro; `create`/`createMany`/`upsert` inyectan; plataforma sin cliente no filtra; `tenantId` del cliente gana sobre uno enviado en `where`.
  - Script de aislamiento `api/scripts/tenancy-check.ts` contra una BD de prueba: crea tenants A y B con un empleado, horario y checada cada uno; comprueba que A no lista, lee por id, edita ni borra lo de B; limpia al final.

- [ ] **F1A-09 Aplicar y verificar.** Migración en Railway, crear 2 tenants de prueba, login por subdominio de cada uno, correr `tenancy-check`, actualizar fichas de módulos y `AGENTS.md`.

### Fase 1b — Endurecimiento del aislamiento y de la escala

- [ ] **F1B-01 RLS en Postgres.** Políticas `USING ("tenantId" = current_setting('app.tenant_id'))` en las 22 tablas; la extensión hace `SET LOCAL app.tenant_id` por transacción; rol de BD de la app sin `BYPASSRLS`; rol de workers/plataforma aparte.
- [ ] **F1B-02 Workers fuera del proceso web.** `api/src/workers/index.ts` como segundo entrypoint (mismo código); el API ya no arranca sync ni correo. Requisito para correr 2+ réplicas del API (ARQUITECTURA §1.1).
- [ ] **F1B-03 Cola** (según A1): sync de relojes, cálculo de asistencia, exports xlsx/PDF y correo como trabajos por cliente.
- [ ] **F1B-04 Zona horaria por cliente** en `computeWorkday`, reportes y cortes de "hoy".
- [ ] **F1B-05 S3 con prefijo `tenant/<id>/`** y canales Ably `tenant:<id>:*`.
- [ ] **F1B-06 Relojes con API key por cliente** (alta del reloj = serial + key ligada al tenant).
- [ ] **F1B-07 PgBouncer + `connection_limit`** (regla: réplicas × límite ≤ 70 % del máximo de la BD).
- [ ] **F1B-08 Índices de alto volumen**: `time_clock_punches (tenantId, employeeNumber, occurredAt)`, `access_events (tenantId, …, occurredAt)`.

### Fase 2 — Requisitos NOM (antes de vender "cumple NOM")

- [ ] **F2-01** Inmutabilidad de checadas + registro de ajustes (quién, cuándo, por qué, valor anterior).
- [ ] **F2-02** Pista de auditoría de correcciones y aprobaciones de horas extra.
- [ ] **F2-03** Alertas de límite de jornada.
- [ ] **F2-04** Retención configurable por cliente + archivado.
- [ ] **F2-05** Corregir bug de retardo (caso DEMO-911, "Retardo 5:59 h") en `schedules/computeWorkday`.
- [ ] **F2-06** Validar requisitos STPS (formato, retención, integridad) con asesor legal.

### Fase 3 — Consola de plataforma y onboarding

- [ ] **F3-01** Consola de plataforma (web, solo ADMIN/SUPPORT): lista de clientes, plan, estado, uso (empleados activos, checadas/día, relojes).
- [ ] **F3-02** Alta de cliente guiada: tenant + `CLIENT_ADMIN` + catálogos plantilla + correo de bienvenida.
- [ ] **F3-03** "Entrar como cliente" para soporte, con auditoría.
- [ ] **F3-04** Límites por plan (`employeeLimit`, relojes) aplicados en altas y en la consola.
- [ ] **F3-05** Branding por cliente (logo y color) y correo con remitente por cliente.
- [ ] **F3-06** Subdominios en producción (DNS wildcard + certificado wildcard).

### Fase 4 — Operación SaaS

- [ ] **F4-01** Cobro (según D5): suscripción por empleado activo/mes.
- [ ] **F4-02** Rate limiting por IP y por cliente; `compression`; paginación por cursor en todos los `/query`.
- [ ] **F4-03** Observabilidad: request-id, métricas (latencia por ruta, profundidad de cola), alertas.
- [ ] **F4-04** Backups y restore **por cliente** ensayado.
- [ ] **F4-05** Prueba de carga con k6: 5,000 checadas en 10 min + dashboards concurrentes.
- [ ] **F4-06** CI en la raíz (`.github/workflows`): typecheck, lint, unit, build de imágenes **con nombre TimeManager**.

### Fase 5 — Enterprise (cuando lo pida un cliente)

- [ ] **F5-01** SSO (SAML/OIDC).
- [ ] **F5-02** BD dedicada por cliente (exportar su slice).
- [ ] **F5-03** SLA y residencia de datos.

### Limpieza heredada (paralelizable, en cualquier momento)

- [ ] **L-01** `notificationRoute` en `web/src/entities/notification/model/types.ts` aún apunta a `/tickets`, `/inventory`, `/kitchen`.
- [ ] **L-02** Borrar carpetas vacías del API: `inventory`, `kitchen`, `tickets`, `hotel-store`, `material-outputs`, `reports`, `suppliers`.
- [ ] **L-03** Políticas ABAC de órdenes de compra/facturas en `api/src/core/policies/seed.ts` (residuo del ERP).
- [ ] **L-04** `api/.github` y `web/.github` publican imágenes `axzydev/axzy_ptnv_*` (Puerto Nuevo): borrarlos y crear CI propio en F4-06. **No moverlos a la raíz.**
- [ ] **L-05** `web/Dockerfile` copia `nginx.conf` y `render-config.sh`, que no existen en el repo.
- [ ] **L-06** `web/docs/MODULES.md` desactualizado (rutas y componentes que ya no existen).
- [ ] **L-07** Catálogos `Gender`/`BloodType` son de plataforma: quitarle `catalogs.manage` sobre ellos a `CLIENT_ADMIN`.
- [x] **L-08** Enums huérfanos del ERP sin modelos ni referencias: `MaterialOutputReason`, `DeviceUnitStatus`, `MovementType`, `MovementStatus`, `LoanStatus`, `ItemCondition`, `TicketStatus`, `TicketPriority`, `AssignmentStatus` (borrados del schema).
- [x] **L-09** `User.company` (texto libre, muere con D2 en favor de `tenantId`): borrado del schema, DTOs/entities/mappers/services de `users` y `hr`, y de la web (hero, tipos). La migración F1A-02 debe incluir el `DROP COLUMN`.
- [ ] **L-10** `Notification.ticketId` + canal Ably `tickets:` + referencias en `appEvents`, `useAblyNotifications` y DTO de `dashboard` (residuo de tickets).
- [ ] **L-11** `AuditLog.deviceId`/`deviceCode` (residuo del audit de inventario): DTO/entity/mapper de `audit` + writers del `AuditLogger`.
- [ ] **L-12** `DepartmentTicketSchema` en el DTO de `departments` y grupo `tickets` en el DTO de `dashboard`.

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
