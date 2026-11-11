# Operación en producción (local-first)

Cómo correr CheckLab en producción: procesos, RLS, cola, conexiones,
observabilidad y despliegue. Complementa [ARQUITECTURA.md](ARQUITECTURA.md)
(decisiones y cargas objetivo) y [PLAN_IMPLEMENTACION.md](PLAN_IMPLEMENTACION.md).

## 1. Procesos

| Proceso | Entrypoint | Réplicas | Hace |
|---|---|---|---|
| `api` | `node dist/src/index.js` | N (detrás del LB) | HTTP stateless. **No** corre workers salvo `RUN_WORKERS_IN_API=true` (solo local). |
| `workers` | `node dist/src/workers/index.js` | 1+ | Sync de relojes, padrón, drenado de correo y cola pg-boss. Un solo líder (lock en Postgres) corre los timers; los jobs se reparten entre réplicas. |
| `release` | `pnpm --filter timemanager-api prisma:migrate` | 1 | `prisma migrate deploy` **antes** de levantar la réplica nueva. La migración ya no va en el CMD de la imagen. |

Local:

```bash
pnpm --filter timemanager-api dev          # API (RUN_WORKERS_IN_API=true en api/.env)
pnpm --filter timemanager-api workers      # workers en su propio proceso
```

### Lock de líder

`worker_locks` (migración `20261108002000_worker_locks`): una fila por lock con
`holder` + `heartbeatAt`. El líder renueva cada `LEADER_LOCK_TTL_MS`/3 aprox.;
si el proceso muere, el heartbeat caduca y otro worker toma el liderazgo sin
intervención. Sirve para los timers periódicos; **no** para los jobs: esos los
reclama pg-boss con lock de fila (cada job se procesa una sola vez aunque haya
N réplicas de worker).

## 2. RLS en Postgres (F1B-01)

Migración `20261108000000_rls_tenant_isolation`:

- Función `app_current_tenant_id()` = `NULLIF(current_setting('app.tenant_id', true), '')`.
- `ENABLE` + `FORCE ROW LEVEL SECURITY` y política `tenant_isolation` en **todas**
  las tablas con `tenantId` NOT NULL (`USING` y `WITH CHECK`).
- Fail-closed: sin `app.tenant_id` no se ve ni se escribe ninguna fila de cliente.

La app fija la variable **por transacción** con
`set_config('app.tenant_id', $1, true)` desde la extensión de Prisma
(`api/src/core/tenancy/extension.ts`) cuando `RLS_ENABLED=true`. Las
transacciones interactivas usan `tenantTransaction(db, fn)` (`api/src/core/tenancy/tenant-transaction.ts`),
que fija la variable al abrir la transacción y evita el doble envoltorio.

### Roles

`api/prisma/rls/roles.sql` (ejecutar una vez con el admin de Postgres):

- `tm_app`: rol del API, **sin** `BYPASSRLS`. `DATABASE_URL` conecta con él.
- `tm_worker`: rol de workers/plataforma, **con** `BYPASSRLS` (itera clientes y
  drena colas globales sin contexto). Opcional: `WORKER_DATABASE_URL`.

```bash
psql "$ADMIN_DATABASE_URL" -f api/prisma/rls/roles.sql
# .env del API: RLS_ENABLED=true y DATABASE_URL con el rol login de tm_app
```

Verificación: con un rol sin `BYPASSRLS`, `SELECT ... FROM departments` sin
`app.tenant_id` devuelve 0 filas y un `INSERT` con otro `tenantId` falla por
`WITH CHECK`. La suite `api/tests/integration/infra.flow.test.ts` lo prueba con
un rol restringido real. La suite completa de integración también corre con
`RLS_ENABLED=true` (misma numeración de tests, 105/105).

### Bypass pre-contexto (login y token de agente)

Dos lookups ocurren **antes** de saber el cliente y no pueden usar
`app.tenant_id`:

- login de usuario (`AuthService.login`, `authenticate` revalida por id);
- autenticación de agente por hash del token (`authenticateAgent`), porque
  `agents` sí es tabla de cliente.

Migración `20261108003000_rls_bypass`: la política pasa a
`USING (app_bypass_rls() OR "tenantId" = app_current_tenant_id())` (igual en
`WITH CHECK`). La app activa `app_bypass_rls='on'` **solo** en esas llamadas,
con `runWithRlsBypass()` (`core/tenancy/context.ts`), que hace que la extensión
abra la transacción con `set_config('app.bypass_rls','on',true)`. No se deriva
de datos del request: lo usan únicamente rutas de sistema. Regla: nunca envolver
endpoints de negocio con `runWithRlsBypass`.

Tests: `infra.flow.test.ts` corre con `RLS_ENABLED=true` y verifica login +
token de agente; la suite completa también pasa con RLS activo.

> Nota: con RLS activo cada operación de modelo de cliente abre su transacción
> con `set_config` (coste de ~1 round-trip extra). Es una red de seguridad: lo
> normal sigue siendo el filtro de la extensión.

## 3. Cola pg-boss (F1B-03, A1 cerrada)

Sin Redis: pg-boss usa el mismo Postgres, esquema `pgboss` (se crea solo al
arrancar el worker). Jobs periódicos (los programa el líder, idempotente):

| Job | Cron | Qué hace |
|---|---|---|
| `email.drain` | cada minuto | drena `email_logs` (además el líder tiene un poll rápido de `EMAIL_QUEUE_POLL_MS`). Las filas se **reclaman** (`updateMany` por `PENDING`), así dos procesos no envían el mismo correo. |
| `time-clock.sync` | cada 5 min | `service.sync()` por cliente (solo lectura de relojes). |
| `roster.run` | cada hora | padrón de relojes por cliente. |
| `agent.job` | a demanda | trabajos del agente on-prem (F1B-11/13); el módulo de agente registra handlers con `registerAgentJobHandler(kind, fn)` y encola con `enqueueAgentJob({kind, tenantId, ...})`. |

`QUEUE_ENABLED=false` desactiva pg-boss (solo desarrollo).

## 3.1 Aislamiento por cliente de archivos y realtime (F1B-05)

- **S3**: todas las claves pasan por `scopedObjectKey` → `tenant/<tenantId>/…`
  (subida, descarga y URL firmada). Es idempotente y deja pasar claves
  históricas cuando no hay contexto; una clave de otro cliente no se puede leer
  con el contexto actual. El bucket sigue siendo privado.
- **Ably**: las notificaciones se publican en `tenant:<tenantId>:user:<userId>`
  (y temporalmente también en `user:<userId>`); `broadcastToTenant` usa
  `tenant:<tenantId>:broadcast`. El **TokenRequest** emitido al navegador
  incluye la capability de suscripción a AMBOS canales del usuario cuando tiene
  cliente (`tenant:<id>:user:<id>` + `user:<id>`) y solo `user:<id>` para
  plataforma sin cliente; nunca canales de otros usuarios/clientes ni publish.

## 4. Conexiones: PgBouncer (F1B-07)

Regla: **réplicas × `connection_limit` ≤ 70% del máximo de conexiones de la BD**.
Con PgBouncer en modo transacción, Prisma debe desactivar prepared statements.

```bash
# Ejemplo: BD de 100 conexiones, 4 réplicas de API → 4 × 10 = 40 (40%)
DATABASE_CONNECTION_LIMIT=10
DATABASE_PGBOUNCER=true        # agrega ?pgbouncer=true a la URL de Prisma
# DATABASE_POOL_TIMEOUT=10000
```

Guía (no se aplica desde el repo): Railway → añadir PgBouncer delante del
Postgres, apuntar `DATABASE_URL` al puerto de PgBouncer (6543), fijar el límite
del pool de PgBouncer y de Prisma con la regla anterior, y correr migraciones
con la conexión directa (no por PgBouncer).

## 5. Producción (F1C-03)

- `compression()` (gzip/br) para respuestas JSON grandes.
- Rate limit en memoria: `/auth/login` (`RATE_LIMIT_LOGIN_MAX`, 20/15 min) y
  `/query|/sync|/import|/ingest|/punches` más las subidas `POST /hr/:id/documents`
  y `POST /hr/:id/photo` (`RATE_LIMIT_QUERY_MAX`, 600/15 min)
  **por cliente** (`RATE_LIMIT_PER_TENANT`, clave `tenant:<id>` del JWT) con
  respaldo por IP para anónimos/plataforma. Las descargas GET de fotos y
  documentos no se limitan. Sustituible por store Redis sin cambiar el contrato.
- `trust proxy` configurable (`TRUST_PROXY=1` para Railway) para IP real.
- `BODY_LIMIT` (default `1mb`) en el JSON parser.
- `SIGTERM`/`SIGINT`: cierra el server HTTP, detiene workers, suelta el lock de
  líder y hace `prismaClient.$disconnect()` con timeout de 20 s.
- `audit_log` de accesos denegados **frenado**: máximo 1 por usuario+permiso+ruta
  cada 60 s (antes un bucle escribía una fila por 403).
- Imagen (`api/Dockerfile`): multi-stage, instala solo dependencias de
  producción, `USER node` (sin root), `HEALTHCHECK` contra `/api/v1/health`.
  Migraciones fuera del CMD (paso de release).

Variables nuevas: ver `api/.env.example` (`RLS_ENABLED`, `WORKER_DATABASE_URL`,
`RUN_WORKERS_IN_API`, `LEADER_LOCK_*`, `TRUST_PROXY`, `BODY_LIMIT`,
`RATE_LIMIT_*`, `METRICS_TOKEN`, `LOG_JSON`, `DATABASE_*`).

## 6. Observabilidad (F4-03)

- **Request-id**: se respeta `X-Request-Id` del proxy o se genera; se devuelve en
  la respuesta. Los logs Winston lo incluyen junto con `userId` y `tenantId`.
- **Logs JSON** en producción (`LOG_JSON=true` o `NODE_ENV=production`): campos
  `requestId`, `userId`, `tenantId`, `service`.
- **Métricas**: `GET /metrics` (también `/api/v1/metrics`) con `prom-client`:
  latencia por método/ruta/estado (`http_request_duration_seconds`), totales,
  errores 5xx, `queue_depth{queue}` y `worker_leader`. Protegido: `METRICS_TOKEN`
  (`Authorization: Bearer …`) o JWT de ADMIN/SUPPORT. En el API-process las
  métricas de cola son 0/parciales; el scrape real de cola sale del proceso de
  workers.
- **Alertas sugeridas**: 5xx > 1% en 5 min, p95 > 500 ms, `queue_depth` de
  `email.drain`/`time-clock.sync` creciendo por 15 min, `worker_leader` en 0 en
  todas las réplicas de worker, y `/api/v1/health/ready` en 503.

## 7. Índices de alto volumen (F1B-08)

Migración `20261108001000_high_volume_indexes`:

- `time_clock_punches (tenantId, employeeNumber, occurredAt)`
- `access_events (tenantId, employeeId, occurredAt)`
- `email_logs (tenantId, status, nextAttemptAt)`

Migración `20261210000000_time_clock_punch_tenant_occurred_index`: agrega
`time_clock_punches (tenantId, occurredAt)` para los reportes/ingesta que filtran
todo el cliente por rango de fechas (sin empleado).

Particionado por mes y retención quedan para cuando una tabla pase de ~50M
filas (ver ARQUITECTURA §2).

## 8. Respaldo y restore por cliente (F4-04)

`api/scripts/tenant-backup.ts` exporta **el slice completo de un cliente** sin
detener el API: la fila de `tenants`, **todas** las tablas con `tenantId`
(descubiertas en vivo de `pg_attribute`, hoy 39, así una tabla nueva entra sola),
las filas de catálogos globales que el cliente referencia (p. ej. `plans`,
`roles`) en `prerequisites/`, y opcionalmente (`--s3`) los archivos del
expediente del bucket privado. El respaldo es un directorio con `manifest.json`
(conteo + `sha256` por tabla), `data/*.json`, `prerequisites/*.json` y `files/`.

```bash
# desde api/
# Exportar (admite la nube; usa DATABASE_URL o --database-url)
node --require ts-node/register/transpile-only \
     --require tsconfig-paths/register scripts/tenant-backup.ts \
     export --tenant=acme --out=/srv/backups/acme-2026-11-05 [--s3]

# Restaurar en una BD limpia (solo local salvo --allow-remote)
node ... scripts/tenant-backup.ts restore --in=/srv/backups/acme-2026-11-05 \
     --database-url=postgresql://postgres:test@127.0.0.1:55433/tm_restore \
     [--s3] [--allow-remote]

# Verificar que una BD coincide con el respaldo (no escribe)
node ... scripts/tenant-backup.ts verify --in=/srv/backups/acme-2026-11-05 \
     --database-url=postgresql://postgres:test@127.0.0.1:55433/tm_restore
```

- Restaura primero catálogos globales y luego tablas en orden de FKs; al final
  compara conteos y hashes y sale con código ≠ 0 si algo difiere. Aborta si la BD
  destino ya tiene datos de ese cliente (salvo `--replace`, destructivo).
- **Runbook de restore real**: BD nueva vacía + `prisma migrate deploy` →
  restaurar → `verify` → apuntar el API a esa BD. No restaurar encima de la BD
  productiva sin respaldo completo previo.
- **NOM / checadas append-only**: borrar el slice de un cliente con checadas
  requiere `--bypass-triggers` (`session_replication_role = replica`, superusuario
  o dueño de tablas). En producción, preferir restaurar en BD limpia.
- **RLS**: exportar con un rol `BYPASSRLS` (workers/migraciones) o el export verá
  0 filas; el restore escribe con el rol de migraciones.
- Datos sensibles: cifrar el directorio del respaldo y limitar acceso. Para S3,
  `--s3` copia los objetos del cliente, pero el bucket debe respaldarse aparte
  (versioning + lifecycle).
- **Ensayo real (2026-11-05)**: `scripts/tenant-backup.rehearse.ts` sembró un
  cliente con datos representativos, exportó **17 filas / 39 tablas**, borró el
  slice (0 filas) y restauró en la BD origen y en una **BD limpia** (`tm_test_restore`)
  con conteos y hashes idénticos, en **0.8 s**; `verify` reconfirmó las 39 tablas.
- Frecuencia sugerida: export diario por cliente (o `pg_dump` completo como
  respaldo primario), restore de ensayo semanal y export total antes de
  migraciones/cutover.

## 9. Prueba de carga (F4-05)

Scripts de carga en `api/load/` (detalle y comandos en `api/load/README.md`):

| Escenario | Script k6 | Umbral |
|---|---|---|
| Login | `load/k6/login.js` | error < 1 %, p95 < 1000 ms |
| Dashboards concurrentes | `load/k6/dashboards.js` | error < 1 %, p95 < 800 ms |
| Ingesta de checadas por lote (agente) | `load/k6/agent-punches.js` | error < 1 %, p95 < 800 ms |

`load/smoke.mjs` es un smoke de Node sin dependencias (lo que corre en este
equipo, porque no hay k6 instalado) con los mismos escenarios y umbrales.
`load/server.ts` arranca el API de carga **sin workers** y con el catálogo de
permisos sembrado; `scripts/load-seed.ts` siembra la BD dedicada `tm_test_load`.

**Evidencia del smoke local (2026-11-05)**, API en `127.0.0.1:4020`,
concurrencia 5: login 30 reqs p50 505.1 / p95 609.6 ms; dashboards 60 reqs p50
13.8 / p95 78.7 ms; ingesta del agente 20 lotes de 25 checadas p50 25.9 / p95
44.1 ms; total 110 reqs, 0 errores, p95 global 599.7 ms, p99 609.6 ms, ~179 req/s.
El login (bcrypt) domina la latencia; la ingesta está holgada frente a las 5,000
checadas/10 min del objetivo, pendiente de probar con volumen real de un cliente
grande.

El job manual del CI es `.github/workflows/load-test.yml` (`workflow_dispatch`):
Postgres 16, migraciones, seed, API en 4020, smoke y, con `scenario=k6`, los tres
escenarios k6. Nunca corre en push.


## Subdominios de clientes

Dar de alta un cliente en la consola (`/` → **Nuevo cliente**) no toca DNS ni el
servidor: su entrada queda lista al instante. Hay dos modos y la web elige solo.

**Sin dominio propio** (p. ej. una URL de Railway): cada cliente entra por su
ruta, `https://<host-de-la-web>/#/<slug>/home`. No requiere configuración.

**Con dominio propio** (`<slug>.tudominio.mx`), se configura **una sola vez**:

1. DNS: registro comodín `*.tudominio.mx` hacia el servicio web (más
   `app.tudominio.mx` para la plataforma).
2. Hosting del web: agregar `*.tudominio.mx` como dominio del servicio, con
   certificado comodín. `web/nginx.conf` ya responde a cualquier host.
3. Contenedor web: `TENANT_BASE_DOMAIN=tudominio.mx` (runtime, sin recompilar).
4. API: `WEB_ORIGIN=https://*.tudominio.mx,https://app.tudominio.mx`.

Después de eso, cada alta nueva responde en `https://<slug>.tudominio.mx` sin
pasos extra. `app.`, `admin.` y `www.` son de plataforma. El subdominio se
puede cambiar desde la ficha del cliente (**Cambiar subdominio**): la dirección
anterior deja de funcionar al instante.
