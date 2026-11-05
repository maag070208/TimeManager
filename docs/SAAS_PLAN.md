# Plan SaaS — TimeManager multi-cliente

Objetivo: vender TimeManager como SaaS a N clientes, donde cada cliente (tenant) tiene su propio personal, departamentos, horarios, relojes, checadas, reportes y configuración — con aislamiento total de datos entre clientes.

Documento de planeación vivo: las decisiones marcadas **[ABIERTA]** necesitan respuesta antes de codificar la fase correspondiente.

---

## 1. Estado actual (punto de partida)

- El repo ya es la extracción RH standalone: 14 módulos, 36 modelos, migración baseline `20261104000000_baseline_rh`.
- **No existe ningún concepto de tenant.** Todo cuelga de `User`; el campo `User.company` es texto libre y no sirve como aislamiento.
- Unicidades globales que chocan con multi-cliente: `User.username`, `User.email`, `User.employeeNumber`, `Department.name`, `Site.name/code`, `TimeClock` (serial), catálogos.
- Zona horaria única (la del servidor) para todos los cálculos de jornada.
- Storage (S3) sin prefijo por cliente; correo con un solo remitente.
- Lo que **ya está bien** para el SaaS/NOM: `AccessEvent` es inmutable con anulación lógica; existe `AuditLog`; permisos por rol ya funcionan.

---

## 2. Decisiones de arquitectura

### D1 — Modelo de tenancy **[DECIDIDA 2026-11-04: A]**

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A. Schema compartido + `tenantId`** (recomendada) | Una BD, todas las tablas de negocio llevan `tenantId` | Costo bajo, migraciones simples, onboarding instantáneo | Aislamiento por aplicación (disciplina + RLS), "noisy neighbor" |
| B. Schema por tenant | Una BD, un schema Postgres por cliente | Aislamiento fuerte, restores por cliente | Migraciones × N schemas, conexiones × N |
| C. BD por tenant | Base dedicada por cliente | Máximo aislamiento, clientes grandes/regulados | Costo y operación altos |

**Recomendación: A para el lanzamiento**, con disciplina fuerte (middleware + Postgres Row-Level Security), y dejar la puerta a C como "tier enterprise" (mover un tenant a BD dedicada exportando su slice). B no aporta suficiente sobre A para su costo.

### D2 — Identidad y login **[DECIDIDA 2026-11-04: B]**

| Opción | Descripción |
|---|---|
| **A. Email global + membresías** (recomendada) | El email es único en la plataforma; un usuario puede pertenecer a varios tenants (`TenantMembership`). Al entrar elige cliente (o se le manda a su subdominio). |
| B. Usuario por tenant | `@@unique([tenantId, username])`; la misma persona tiene cuentas distintas por cliente. Más simple, peor experiencia. |

**Decisión: B.** El producto es renta de checadas: cada empleado pertenece a una sola empresa. `username`, `email` y `employeeNumber` son únicos **dentro** del tenant. Los usuarios de plataforma (`ADMIN`, `SUPPORT`) no tienen tenant. Si aparece una consultora multi-cliente se agrega `TenantMembership` sin romper B.

### D3 — Resolución del tenant **[DECIDIDA 2026-11-04: subdominio]**

- **Subdominio** (`cliente.timemanager.mx`) — recomendada: branding claro, login sin ambigüedad, fácil en Vite/nginx.
- Ruta (`app.timemanager.mx/c/cliente`) — más simple de DNS, peor marca.
- Selector post-login — suficiente si D2=A como fallback.

### D4 — Datos compartidos vs por tenant

| Dato | Nivel |
|---|---|
| Catálogo de permisos, roles plantilla | **Plataforma** (global) |
| Roles creados por el cliente, políticas | Tenant |
| Catálogos RH (género, sangre, tipo de documento, motivos de baja) | Plantilla global copiada al tenant, editable por tenant |
| Reglas de jornada, zona horaria, plantillas de correo, aviso de privacidad | Config por tenant |
| Usuarios, departamentos, horarios, relojes, checadas, eventos, documentos | Tenant (siempre) |

### D5 — Planes y límites **[ABIERTA]**

Modelo de plan (p. ej. por número de empleados activos + módulos): básico (checadas + asistencia), pro (+ tiempo extra, nómina export), enterprise (+ SSO, BD dedicada, SLA). Los límites se enforcean en `permissions`/políticas y en onboarding. Billing: definir proveedor (Stripe / Conekta / facturación manual al inicio).

---

## 3. Cambios estructurales (qué se construye)

### 3.1 Modelo de datos

1. **Nuevas tablas de plataforma**: `Tenant` (nombre, slug, plan, zona horaria, estado, aviso de privacidad), `TenantMembership` (userId × tenantId + rol), `Plan`/`Subscription` (si D5 aplica), `PlatformAuditLog` (auditoría de operadores del SaaS).
2. **`tenantId` (FK a `Tenant`, índice) en todas las tablas de negocio**: users (vía membership), departments, subareas, schedules, schedule_assignments, time_clocks, time_clock_punches, time_clock_employees, roster, access_events, sites, overtime_approvals, payroll_*, notifications, audit_logs, employee_documents, disciplinary_reports, sys_config (las de tenant), email_logs.
3. **Rehacer unicidades compuestas**: `@@unique([tenantId, name])` en departments, sites, schedules…; username/email según D2.
4. **Índices de alto volumen**: `time_clock_punches (tenantId, userId, occurredAt)`, `access_events (tenantId, employeeId, occurredAt)`; evaluar particionado mensual de ambas cuando un tenant supere ~10M de filas.

### 3.2 Backend

1. **Middleware de tenant**: resuelve tenant desde subdominio/JWT, lo inyecta en el request y **todas las queries Prisma lo filtran** (extensión/middleware de Prisma que agrega `tenantId` automáticamente — sin esto, el aislamiento depende de memoria humana).
2. **Postgres RLS** como segunda línea de defensa (`tenant_id = current_setting('app.tenant')`).
3. **JWT con `tenantId` + roles dentro del tenant**; `auth` actualiza login/refresh (D1/D2).
4. **Módulo nuevo `tenants`**: CRUD de clientes (solo operadores del SaaS), onboarding (crea tenant + admin + catálogos plantilla + roles plantilla), suspensión y offboarding (export + borrado).
5. **Storage con prefijo `tenant/<id>/…`**; correo con remitente/plantilla por tenant; canales Ably namespacerse por tenant.
6. **Zona horaria por tenant**: todos los cortes de día (`computeWorkday`, reportes, "hoy") usan la TZ del tenant, no la del servidor.

### 3.3 Frontend

1. Selector/resolución de tenant (según D3) y guarda que exija membresía.
2. Pantalla de onboarding self-service (alta de cliente + primer admin) y consola de plataforma (solo operadores: lista de tenants, plan, estado).
3. Configuración por tenant: zona horaria, reglas de jornada, plantillas, aviso de privacidad, branding básico (logo/colores).

### 3.4 Relojes físicos (caso especial)

- El serial del reloj se registra a un tenant en el alta; la sincronización autentica por API key del reloj ligada al tenant (no por sesión de usuario).
- **Un reloj por cliente**, instalado en su red local (`192.168.x`): las credenciales del API hacia el Hikvision (usuario/contraseña) deben ir por reloj en la BD, cifradas (F1B-10); el `.env` solo es default de desarrollo.
- El API en la nube **no alcanza** la red del cliente: falta decidir gateway/agente on-prem con conexión saliente o VPN por cliente (A4 / F1B-11).
- La **estación de enrolamiento de huellas es de TimeManager** (central, no del cliente): se configura en `sys_config` y el enrolamiento apunta al reloj del cliente destino (F1B-12).
- Un reloj jamás se mueve de tenant sin re-provisioning (borra personas y checadas del reloj anterior).

---

## 4. Roadmap por fases

| Fase | Contenido | Sale con |
|---|---|---|
| **0. Base** (hecho) | Extracción RH standalone, baseline Prisma, docs/ | — |
| **1. Multi-tenant interno** | 1a: `Tenant` + `tenantId` en todo, extensión Prisma, JWT con tenant, unicidades compuestas, login por subdominio (ver §4.1). 1b: RLS, TZ por tenant, S3/Ably por tenant | Staging con 2 tenants de prueba |
| **2. Endurecimiento NOM** | Inmutabilidad de checadas con registro de ajuste, auditoría de correcciones y aprobaciones, alertas de límite de jornada, retención configurable | Requisito de venta (ver `RH_MODULO_STANDALONE.md` §5) |
| **3. Onboarding y planes** | Alta self-service, consola de plataforma, límites por plan, correo/branding por tenant, portal del empleado multi-tenant | Primeros clientes reales |
| **4. Operación SaaS** | Billing (D5), métricas por tenant (uso, volumen de checadas), backups y restore por tenant, rate limiting, status page | Escalamiento |
| **5. Enterprise** (opcional) | SSO, BD dedicada por tenant (D1-C), SLA, residencia de datos | Cuando lo pida un cliente |

### 4.1 Fase 1a — plan detallado

Estado de partida (2026-11-04): BD de Railway recién migrada con el baseline, solo roles/permisos y el usuario de plataforma `martin.amaro`. No hay datos de cliente que migrar, pero la migración se escribe como si los hubiera (expand → backfill → contract).

**Clasificación de modelos**

| Nivel | Modelos | `tenantId` |
|---|---|---|
| Plataforma | `Role`, `Permission`, `RolePermission`, `Policy*`, `Gender`, `BloodType`, `SysConfig` (pasa a tenant en 1b) | No |
| Mixto | `User` (null = plataforma), `AuditLog`, `EmailLog` (null = acción de plataforma) | Nullable |
| Cliente | `Department`, `Subarea`, `DocumentType`, `RemovalCategory`, `EmployeeDiscount`, `EmployeeDocument`, `DisciplinaryReport`, `Notification`, `Site`, `AccessEvent`, `Schedule`, `ScheduleDay`, `ScheduleAssignment`, `PayrollWeekClosure`, `PayrollDepartmentReview`, `OvertimeApproval`, `TimeClock`, `TimeClockPunch`, `TimeClockSyncEvent`, `TimeClockEmployee`, `TimeClockRosterEntry`, `TimeClockRosterRun` | Obligatorio |
| Hereda del usuario | `UserRole`, `UserPermission` | No (se acceden por `userId`) |

`tenantId` se desnormaliza también en hijos (`ScheduleDay`, `Subarea`, …): un filtro uniforme y RLS barato en 1b.

**Unicidades que cambian**

| Antes (global) | Después |
|---|---|
| `users.username`, `users.email`, `users.employeeNumber` | `(tenantId, …)` + índice parcial `WHERE "tenantId" IS NULL` para usuarios de plataforma |
| `departments.name`, `document_types.name`, `schedules.name`, `removal_categories.key`, `sites.name`, `sites.code` | `(tenantId, …)` |
| `payroll_week_closures.weekStart` | `(tenantId, weekStart)` |
| `time_clocks.url` | `(tenantId, url)` (dos clientes pueden tener el mismo `192.168.1.10`) |
| `time_clocks.serialNumber` (PK), punches `(clockSerial, serialNo)` | Sin cambio: el serial es del hardware y un reloj pertenece a un solo tenant |

**Migración SQL (a mano, `20261105000000_tenancy`)**

1. `CREATE TABLE tenants` (`id`, `name`, `slug` único, `status` ACTIVE/SUSPENDED, `timezone` default `America/Mexico_City`, `employeeLimit`, `plan`, timestamps).
2. Insertar el tenant `demo`.
3. `ADD COLUMN "tenantId"` nullable en las tablas de cliente y mixtas; backfill a `demo` (usuarios: solo los que no son `ADMIN`/`SUPPORT`).
4. `SET NOT NULL` en las de cliente; FKs a `tenants` con `ON DELETE RESTRICT`.
5. Quitar los índices únicos globales y crear los compuestos + parciales; índices `(tenantId, …)` en las tablas de alto volumen (`time_clock_punches`, `access_events`, `notifications`).
6. Rollback: script inverso en la misma carpeta (drop columnas/tabla, recrear únicos globales) — solo válido mientras exista un único tenant.

**Contexto de tenant (API)**

- `core/tenancy`: `AsyncLocalStorage<{ tenantId: string | null; platform: boolean }>`.
- Middleware tras `authenticate`: toma `tenantId` fresco de la BD (no del JWT) y rechaza si el tenant está `SUSPENDED`. Un usuario de plataforma puede elegir cliente con el header `X-Tenant-Id` (validado); sin header opera sin filtro (solo lectura de plataforma).
- **Extensión Prisma** sobre los modelos de cliente: agrega `tenantId` al `where` de lecturas, `update*`, `delete*`, `count`, `aggregate`, `groupBy`, y al `data` de `create*`/`upsert`. `findUnique` se reescribe a `findFirst`. Sin contexto (workers) no filtra ni inyecta: el NOT NULL de la BD obliga a pasar `tenantId` explícito y falla ruidosamente si se olvida.
- Workers: la sincronización de relojes recorre todos los relojes y escribe cada checada con el `tenantId` de su reloj; la cola de correo copia el `tenantId` del registro.
- JWT y `/auth/me` incluyen `tenantId` y `tenant { slug, name }`.

**Login**

- `POST /auth/login` acepta `tenant` (slug). Con slug busca `(tenantId, username)`; sin slug solo encuentra usuarios de plataforma.
- La web lo deriva del subdominio (`acme.localhost:5006` en local; `*.localhost` resuelve a 127.0.0.1 sin configurar DNS). `app.`/`admin.`/sin subdominio = plataforma.
- Selector mínimo de cliente en la barra superior para `ADMIN`/`SUPPORT` (`GET /tenants`), que manda `X-Tenant-Id`. La consola completa de clientes es Fase 3.

**Pruebas**

- Unitarias (sin BD) de la reescritura de argumentos de la extensión: cada operación agrega el filtro, `create` inyecta, plataforma sin header no filtra.
- Script de aislamiento contra una BD: crea tenants A y B con un empleado cada uno y comprueba que A no lista, lee, edita ni borra lo de B (incluido por id directo).
- Se agrega `pnpm test:unit` al API (hoy no existe aunque `AGENTS.md` lo menciona).

**Fuera de 1a**: RLS en Postgres, TZ por tenant en cálculos de jornada, prefijos S3/canales Ably, roles personalizados por tenant (los roles siguen siendo de plataforma), catálogos `Gender`/`BloodType` editables por tenant (en 1a solo los edita plataforma).

---

## 5. Riesgos y pendientes

- **Aislamiento por disciplina**: un solo endpoint sin filtro de tenant filtra datos entre clientes. Mitigar con middleware Prisma + RLS + pruebas de aislamiento automatizadas (test que el tenant A nunca ve datos del B) — agregar a `test:unit`.
- **Volumen**: checadas y access_events crecen ~lineal con (empleados × días × clientes); vigilar índices y particionado desde la fase 1.
- **Migración de unicidades**: cambiar `username @unique` a compuesta requiere migración SQL a mano con backfill (regla del repo).
- **Legal**: cada cliente es responsable de sus avisos de privacidad y consentimientos (biometría/geolocalización); el producto debe proveer las plantillas y el registro de consentimiento por tenant.
- **Requisitos STPS sin publicar**: formato de exportación oficial, retención e integridad siguen "por validar" — diseñar con margen (ver `RH_MODULO_STANDALONE.md` §8).
- **Resuelto (F2-05)**: retardo mal calculado del caso DEMO-911; era la resolución de la asignación de horario (ganaba la vigencia más antigua). `computeWorkday` estaba bien; ver `docs/modules/schedules.md`.
- **Frontend heredado**: menú y rutas de tickets, inventario, cocina y guardia ya se quitaron (2026-11-04); queda limpiar `notificationRoute` y carpetas vacías del API.

---

## 6. Preguntas abiertas (para decidir)

1. **D3** — **Resuelta**: `timemanager.mx` (compra del dominio pendiente del usuario).
2. **D5** — **Pospuesta**: se decide antes de F3-04; considerar Stripe vs Conekta vs facturación manual.
3. ¿El cliente actual migra como tenant #1? — **Resuelta: arrancamos limpios**, sin migrar datos heredados.
4. ¿La app móvil entra al SaaS desde el inicio? — Sigue abierta (add-on posterior).
5. **A4** — ¿el API llega a los relojes on-prem por agente propio (conexión saliente) o por VPN por cliente? Define F1B-11.
