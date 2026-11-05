# Operación en producción (local-first)

Cómo correr TimeManager en producción: procesos, RLS, cola, conexiones,
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
  `/query|/sync|/import` (`RATE_LIMIT_QUERY_MAX`, 600/15 min). Sustituible por
  store Redis sin cambiar el contrato.
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

Particionado por mes y retención quedan para cuando una tabla pase de ~50M
filas (ver ARQUITECTURA §2).
