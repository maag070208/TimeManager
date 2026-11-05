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

### D1 — Modelo de tenancy **[ABIERTA]**

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A. Schema compartido + `tenantId`** (recomendada) | Una BD, todas las tablas de negocio llevan `tenantId` | Costo bajo, migraciones simples, onboarding instantáneo | Aislamiento por aplicación (disciplina + RLS), "noisy neighbor" |
| B. Schema por tenant | Una BD, un schema Postgres por cliente | Aislamiento fuerte, restores por cliente | Migraciones × N schemas, conexiones × N |
| C. BD por tenant | Base dedicada por cliente | Máximo aislamiento, clientes grandes/regulados | Costo y operación altos |

**Recomendación: A para el lanzamiento**, con disciplina fuerte (middleware + Postgres Row-Level Security), y dejar la puerta a C como "tier enterprise" (mover un tenant a BD dedicada exportando su slice). B no aporta suficiente sobre A para su costo.

### D2 — Identidad y login **[ABIERTA]**

| Opción | Descripción |
|---|---|
| **A. Email global + membresías** (recomendada) | El email es único en la plataforma; un usuario puede pertenecer a varios tenants (`TenantMembership`). Al entrar elige cliente (o se le manda a su subdominio). |
| B. Usuario por tenant | `@@unique([tenantId, username])`; la misma persona tiene cuentas distintas por cliente. Más simple, peor experiencia. |

**Recomendación: A.** La mayoría tendrá un solo tenant, pero A no bloquea consultoras/outsourcing de RH que manejan varios clientes.

### D3 — Resolución del tenant **[ABIERTA]**

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
- Un reloj jamás se mueve de tenant sin re-provisioning (borra personas y checadas del reloj anterior).

---

## 4. Roadmap por fases

| Fase | Contenido | Sale con |
|---|---|---|
| **0. Base** (hecho) | Extracción RH standalone, baseline Prisma, docs/ | — |
| **1. Multi-tenant interno** | `Tenant` + `tenantId` en todo, middleware + RLS, JWT con tenant, migración del cliente actual como tenant #1, unicidades compuestas, TZ por tenant | Staging con 2 tenants de prueba |
| **2. Endurecimiento NOM** | Inmutabilidad de checadas con registro de ajuste, auditoría de correcciones y aprobaciones, alertas de límite de jornada, retención configurable | Requisito de venta (ver `RH_MODULO_STANDALONE.md` §5) |
| **3. Onboarding y planes** | Alta self-service, consola de plataforma, límites por plan, correo/branding por tenant, portal del empleado multi-tenant | Primeros clientes reales |
| **4. Operación SaaS** | Billing (D5), métricas por tenant (uso, volumen de checadas), backups y restore por tenant, rate limiting, status page | Escalamiento |
| **5. Enterprise** (opcional) | SSO, BD dedicada por tenant (D1-C), SLA, residencia de datos | Cuando lo pida un cliente |

---

## 5. Riesgos y pendientes

- **Aislamiento por disciplina**: un solo endpoint sin filtro de tenant filtra datos entre clientes. Mitigar con middleware Prisma + RLS + pruebas de aislamiento automatizadas (test que el tenant A nunca ve datos del B) — agregar a `test:unit`.
- **Volumen**: checadas y access_events crecen ~lineal con (empleados × días × clientes); vigilar índices y particionado desde la fase 1.
- **Migración de unicidades**: cambiar `username @unique` a compuesta requiere migración SQL a mano con backfill (regla del repo).
- **Legal**: cada cliente es responsable de sus avisos de privacidad y consentimientos (biometría/geolocalización); el producto debe proveer las plantillas y el registro de consentimiento por tenant.
- **Requisitos STPS sin publicar**: formato de exportación oficial, retención e integridad siguen "por validar" — diseñar con margen (ver `RH_MODULO_STANDALONE.md` §8).
- **Bugs a resolver antes de vender**: retardo mal calculado (caso DEMO-911) en `schedules/computeWorkday`.
- **Frontend heredado**: `web/docs/MODULES.md` y el menú aún reflejan módulos del ERP (inventario, tickets, cocina) que ya no existen en la API — poda pendiente antes de enseñarlo a clientes.

---

## 6. Preguntas abiertas (para decidir)

1. **D1**: ¿schema compartido + RLS (recomendado) o prefieres aislamiento físico desde el día 1?
2. **D2**: ¿email global con membresías (recomendado) o cuenta por cliente?
3. **D3**: ¿subdominio por cliente desde el inicio? ¿qué dominio usamos?
4. **D5**: ¿modelo de planes y cómo se cobra (Stripe/Conekta/manual)?
5. ¿El cliente actual (Puerto Nuevo) migra como tenant #1 en la fase 1, o arrancamos tenants limpios?
6. ¿La app móvil entra al SaaS desde el inicio o se queda como add-on posterior?
