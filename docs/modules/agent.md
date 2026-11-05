# agent — Agente local (TimeManagerAgent)

El API en la nube no alcanza las IPs privadas de los relojes del cliente: el
**agente** es una app Electron instalada en una PC del sitio que abre conexión
saliente, habla ISAPI con el equipo por la LAN y sincroniza checadas y trabajos
de escritura. Es el "brazo local" del SaaS; la fuente de verdad sigue siendo el
API.

```
PC del cliente: TimeManagerAgent (Electron + React)
   ├── ISAPI (LAN)  → reloj Hikvision: eventos por cursor, altas/bajas de persona, tarjetas, huellas
   └── HTTPS saliente → /api/v1/agent/* (token de dispositivo por cliente)
```

## Modelos

- `Agent` — credencial de dispositivo **por cliente**: `tokenHash` (SHA-256
  único), `version` reportada, `active` (revocable), `lastSeenAt`, `lastSyncAt`.
  No usa contraseña de usuario.
- `AgentJob` — cola de trabajos: `type` (`SYNC`, `PERSON_ADD`, `PERSON_REMOVE`,
  `CARD_ADD`, `CARD_REMOVE`, `FINGERPRINT_APPLY`), `payload` JSON,
  `status` (`PENDING`, `RUNNING`, `DONE`, `FAILED`, `CANCELLED`), `attempts` /
  `maxAttempts`, `availableAt` (backoff), `agentId` opcional (dirigido),
  `clockSerial`, `result`, `error`.
- Migración a mano: `api/prisma/migrations/20261107000000_agent`.
- `Agent` y `AgentJob` están en `TENANT_MODELS`: la extensión de tenancy filtra
  e inyecta `tenantId` en todo lo que toca el agente.

## Autenticación

Middleware propio `authenticateAgent` (`modules/agent/middlewares/`) — **no** es
el `authenticate` de usuarios:

1. Lee el token de `Authorization: Bearer <token>` (o `X-Agent-Token`).
2. Guarda solo el hash SHA-256 (`hashAgentToken`); busca `Agent.tokenHash`.
3. Exige `Agent.active` y que el `Tenant` esté `ACTIVE`; si no, 401
   `INVALID_AGENT_TOKEN` / 403 `TENANT_SUSPENDED`.
4. Ejecuta la petición con `runWithTenant(agent.tenantId)`: el agente no puede
   leer relojes, checadas ni trabajos de otro cliente.
5. Revocable (`UPDATE agents SET active = false`) y rotable
   (`POST /agent/token` invalida el anterior de inmediato).

El token en claro solo se muestra al crearlo/rotarlo; en BD vive su hash.
Actualmente se emite con `createAgentToken()` (export del módulo); la consola de
plataforma que lo da de alta es F3-12.

## Endpoints

Todos cuelgan de `/agent` y requieren el token de dispositivo (sin permisos de
usuario).

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/agent/register` | Primer contacto y cada arranque: guarda versión, marca `lastSeenAt`, devuelve tenant + cadencia de sync. Audita `AGENT_REGISTER`. |
| POST | `/agent/token` | Rota el token de dispositivo y devuelve el nuevo (una sola vez). Audita `AGENT_TOKEN_ROTATE`. |
| GET | `/agent/config` | Relojes activos con `url`, `username` y **contraseña descifrada** (AES-256-GCM), `lastSerialNo`, `writeEnabled` y cadencia (`chunkSeconds` 20, `jobsPollSeconds` 5, `heartbeatSeconds` 30). Retroceder el reloj: los dados de baja (sin `url`) no se entregan. |
| POST | `/agent/punches` | Ingesta de un chunk: `{ clockSerial, punches[], lastSerialNo? }`. `createMany(skipDuplicates)` sobre `@@unique(clockSerial, serialNo)`; devuelve `{ received, stored, duplicates, cursor }`. Avanza el cursor del reloj (monótono) y deja un `TimeClockSyncEvent` con `trigger: "AGENT"`. 404 `AGENT_CLOCK_NOT_FOUND` si el reloj no es del cliente o está dado de baja. |
| GET | `/agent/jobs?limit=` | Reclama hasta 5 (máx. 10) trabajos PENDING disponibles, los marca `RUNNING` y suma un intento. Respeta `agentId` dirigido y `availableAt` (backoff). |
| POST | `/agent/jobs/{id}/result` | `{ ok, result?, error? }`. `ok` → `DONE`; fallo con intentos restantes → `PENDING` con backoff exponencial (5 s…5 min); agotado → `FAILED`. Audita el resultado. |
| POST | `/agent/heartbeat` | `{ version?, lastSyncAt?, pendingPunches?, clocks? }`: actualiza `lastSeenAt`/`lastSyncAt`/`version` y devuelve `{ serverTime, nextJobsInMs, pendingJobs }`. |

### Consola (usuarios con JWT, F3-12 / F3-07)

Van en el mismo router, **antes** de `authenticateAgent`: usan `authenticate` de
usuarios, no el token de dispositivo.

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/agent/agents` | personal de plataforma (`tenants.manage` o `time_clocks.manage`) | Lista los agentes del cliente elegido con `X-Tenant-Id` (sin hash ni token). |
| POST | `/agent/agents` | personal de plataforma | Crea el agente y devuelve el token en claro **una sola vez**; audita `AGENT_CREATED`. |
| POST | `/agent/agents/{id}/token` | personal de plataforma | Rota el token (el anterior muere de inmediato) y devuelve el nuevo una sola vez; audita `AGENT_TOKEN_ROTATE`. |
| PATCH | `/agent/agents/{id}` | personal de plataforma | `{ active }`: revoca o reactiva el acceso; audita `AGENT_REVOKED`/`AGENT_REACTIVATED`. |
| POST | `/agent/jobs` | `time_clock.write` (cliente o plataforma con cliente elegido) | Encola `SYNC`, `PERSON_ADD`, `PERSON_REMOVE` o `CARD_ADD` para el agente; valida reloj del cliente y, para escrituras, `writeEnabled` (si no, 403 `TIME_CLOCK_READ_ONLY`); audita `AGENT_JOB_ENQUEUED`. |
| GET | `/agent/jobs/recent` | `time_clock.write` / `time_clocks.manage` / `time_clock.view` | Últimos trabajos del cliente, para el estado en el panel. |

En la web: la consola de plataforma tiene el botón **Agente** por cliente
(`features/tenant/tenants-console/ui/AgentTokenDialog.tsx`) para emitir/rotar/
revocar el token, y la pantalla de relojes del cliente tiene la tarjeta
**Trabajos para el agente local** (`features/access/time-clocks/ui/AgentJobsPanel.tsx`)
para encolar altas/bajas de personas y tarjetas.

## Cola de trabajos (pg-boss pendiente)

La cola vive hoy en la tabla `agent_jobs`. La interfaz
`AgentJobQueue` (`modules/agent/services/agent-job-queue.ts`) + implementación
`TableAgentJobQueue` es el punto de sustitución cuando entre **pg-boss**
(decisión A1): basta una implementación `PgbossAgentJobQueue` con
`enqueue`/`claim`/`complete`/`fail`/`pendingCount`; los endpoints y el agente no
cambian. `retryDelayMs` documenta el backoff compartido.

## App del agente (`agent/`)

Paquete del monorepo (`timemanager-agent`), Electron + Vite + React 19 con
`@axzydev/axzy_ui_system` y tema TimeManager. Ver `agent/README.md` para correr,
compilar y empaquetar (NSIS x64 + AppImage).

- **Main process** (`electron/main.cjs`): ventana + IPC, config en
  `userData/config.json`, cola local en `queue.json`, logs en `userData/logs/`.
  El token se cifra con `safeStorage` cuando el SO lo permite y **nunca** se
  manda a la ventana.
- **Servicio** (`electron/agent-service.cjs`): ciclo leer ISAPI por cursor →
  encolar local → subir chunks → poll de trabajos → heartbeat; local-first (si
  se cae la red sigue leyendo y encolando, y al reconectar sube sin duplicar).
- **Núcleo** (`electron/sync-core.cjs`): puro y testeado con `node:test`
  (ventanas de consecutivos, normalización de eventos ISAPI, dedupe de cola,
  cursor monótono, backoff, cadencias).
- **ISAPI** (`electron/isapi.cjs`): copia sin dependencias del cliente del API
  (Digest, certificado autofirmado, lecturas + escrituras de trabajos).
- **UI**: estado del agente y de cada reloj, cola pendiente, errores, logs
  exportables, "Sincronizar ahora", "Probar reloj", rotar token, intervalo de
  chunk 15–30 s y arranque con el sistema.

## Cadencia (decisión 2026-11-05)

Checadas **por chunks cada 15–30 s configurables** (default 20), poll de
trabajos cada 5 s y heartbeat cada 30 s. Ably sigue disponible como acelerador
opcional para avisos; el transporte base es HTTP + poll (robusto detrás de NAT).

## Pruebas

- Integración: `api/tests/integration/agent.flow.test.ts` (BD `tm_test_agent`):
  credencial (401/403/rotación), registro/config con credenciales descifradas,
  aislamiento entre clientes, ingesta idempotente + cursor + sync event, cola
  claim/result/retry/FAILED, heartbeat.
- Unit: `agent/electron/sync-core.test.cjs` (`pnpm --filter timemanager-agent
  test`).

## Pendientes / riesgos

- **F3-12**: la consola de plataforma ya emite/rota/revoca el token (diálogo
  Agente por cliente) y el panel de relojes encola trabajos. Falta el checklist
  de red/instalador en la consola y la validación de requisitos del equipo.
- **RIESGO ABIERTO (RLS)**: con `RLS_ENABLED=true`, el lookup inicial
  `Agent.findUnique({ tokenHash })` (y el login de usuarios) ocurre **antes** de
  fijar `app.tenant_id`, así que la política RLS lo taparía. El dueño de RLS
  (F1B-01) debe dar bypass a esa consulta (p. ej. función `SECURITY DEFINER` o
  política de autenticación) igual que al login; ya está avisado.
- **pg-boss** (A1): sustituir `TableAgentJobQueue`; hoy no hay worker del API
  para la cola, el agente la consume tal cual.
- **Firma y auto-update** de los instaladores: fase posterior (electron-updater).
- El certificado autofirmado del reloj se acepta sin validar identidad (igual
  que el API): red del cliente asumida confiable; a futuro, pin por reloj.
- La huella viaja como `fingerData` base64 en el payload del trabajo (el panel
  la captura con la estación); el agente solo la aplica.
