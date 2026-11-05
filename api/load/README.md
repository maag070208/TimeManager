# Prueba de carga (F4-05)

Escenarios de carga del API contra una base local `tm_*`. Complementa el smoke
de `load/smoke.mjs` (Node, sin dependencias) que corre en este repo, y los
scripts **k6** que usa el job manual del CI.

## Escenarios y umbrales

| Script | Qué mide | Umbral |
|---|---|---|
| `k6/login.js` | `POST /auth/login` (bcrypt + JWT) | error < 1 %, p95 < 1000 ms |
| `k6/dashboards.js` | `/dashboard/attendance-today`, `/people`, `/overtime-week` con sesión de cliente | error < 1 %, p95 < 800 ms |
| `k6/agent-punches.js` | ingesta por lote como el agente (`POST /agent/punches`, 25 checadas/lote) | error < 1 %, p95 < 800 ms |

Los mismos umbrales aplica `load/smoke.mjs`; si se rebasan, sale con código 1.

## Preparación local

```bash
# 1) BD dedicada (no usar tm_test: las suites la truncan)
docker exec tm-test-pg psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='tm_test_load'" \
  | grep -q 1 || docker exec tm-test-pg createdb -U postgres tm_test_load
cd api
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_test_load npx prisma migrate deploy

# 2) Semilla de carga (crea roles, cliente load-client, usuarios, reloj, 200 checadas)
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_test_load \
  node --require ts-node/register/transpile-only --require tsconfig-paths/register scripts/load-seed.ts
# escribe load/.env.load (ignorado por git) con BASE_URL, TENANT_ID, usuarios, etc.

# 3) API local sin workers y CON catálogo de permisos (load/server.ts) en el puerto 4020
DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_test_load PORT=4020 NODE_ENV=test \
  node --require ts-node/register/transpile-only --require tsconfig-paths/register load/server.ts

# 4) Smoke (Node, sin k6)
node load/smoke.mjs

# 5) k6 (si está instalado: https://k6.io/docs/get-started/installation/)
set -a; source load/.env.load; set +a
k6 run load/k6/login.js
k6 run load/k6/dashboards.js
k6 run load/k6/agent-punches.js
```

Variables opcionales en los scripts k6: `VUS` (default 10), `DURATION`
(default `20s`); en el smoke: `LOAD_CONCURRENCY` (5), `LOAD_BATCHES` (20).

## CI manual

`.github/workflows/load-test.yml` (`workflow_dispatch`): levanta Postgres 16,
migra, corre `load-seed.ts`, arranca el API en 4020, corre `load/smoke.mjs` y,
si se elige el escenario `k6`, instala k6 y corre los tres scripts. No corre en
push: es manual y solo contra la BD del job.

## Notas

- El smoke crea un agente de carga por corrida por la consola
  (`POST /agent/agents`); no necesita que el agente local esté corriendo: la
  ingesta se prueba del lado del API.
- El job usa credenciales de prueba fijas (`load.admin`, `load.client`) creadas
  por `load-seed.ts`; nunca apuntar a una BD que no sea `tm_*` local.
- Si el API corre con `RLS_ENABLED=true`, el rol de conexión debe poder fijar
  `app.tenant_id` (el API lo hace por transacción) y el seed necesita un rol
  con BYPASSRLS para truncar. En local no aplica.
