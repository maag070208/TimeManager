# TimeManagerAgent

Agente local de **TimeManager**: app de escritorio (Electron) que vive en la red
del cliente, habla **ISAPI** con su reloj Hikvision y sube las checadas al API
SaaS. También ejecuta los trabajos de escritura que pide el panel (alta/baja de
personas, tarjetas y huellas) porque el API en la nube no alcanza IPs privadas.

```
PC del cliente
  TimeManagerAgent (Electron)
    UI React (tema TimeManager, @axzydev/axzy_ui_system)
    Servicio local (Node, main process)
      ├── ISAPI → reloj (lectura por cursor + escrituras de trabajos)
      ├── cola local en disco (reintentos, sin pérdida si se cae la red)
      └── HTTPS saliente → API SaaS (/api/v1/agent/*)
```

## Requisitos

- Node 22 + pnpm 12 (el monorepo ya los exige).
- El API con el módulo `agent` (tablas `agents`/`agent_jobs`, migración
  `20261107000000_agent`).
- Un agente dado de alta en la BD del cliente con su token de dispositivo
  (la consola de plataforma lo emitirá en F3-12; por ahora se crea con el
  helper `createAgentToken()` del módulo `agent` del API y se guarda el hash).

## Correr en desarrollo

```bash
# desde la raíz del monorepo
pnpm install --filter timemanager-agent
cd agent
pnpm dev        # solo la UI en http://localhost:5110 (sin Electron)
pnpm app        # compila la UI y abre la app Electron
```

En `pnpm dev` la ventana avisa que falta Electron; es normal: la UI lee el
estado por el preload solo dentro de la app.

## Build e instaladores

```bash
cd agent
pnpm build        # typecheck (tsc) + UI a dist/
pnpm dist:win     # NSIS x64  → release/TimeManagerAgent-Setup-<versión>.exe
pnpm dist:linux   # AppImage  → release/TimeManagerAgent-<versión>.AppImage
```

`electron-builder` compila ambos instaladores desde el mismo `package.json`
(bloque `build`). Firma de código y auto-update (`electron-updater`) quedan para
la fase de distribución (decisión 4 de `docs/ESTADO_DEL_PLAN.md` §4).

## Qué hace

1. **Registro**: `POST /agent/register` con el token de dispositivo; guarda
   tenant/agente y descarga `GET /agent/config` (relojes con sus credenciales
   descifradas, solo para el agente).
2. **Checadas**: cada 15–30 s (configurable, default 20) lee el reloj por
   cursor (`lastSerialNo`), normaliza los eventos ISAPI, los deja en la **cola
   local** (`queue.json`) y los sube por lotes a `POST /agent/punches`. La
   idempotencia es del API (`@@unique(clockSerial, serialNo)`): reintentos y
   chunks repetidos no duplican; el cursor solo avanza cuando el lote fue
   confirmado.
3. **Trabajos**: poll a `GET /agent/jobs` cada 5 s y reporte en
   `POST /agent/jobs/:id/result`. Tipos: `SYNC`, `PERSON_ADD`, `PERSON_REMOVE`,
   `CARD_ADD`, `CARD_REMOVE`, `FINGERPRINT_APPLY`.
4. **Heartbeat** cada 30 s: `POST /agent/heartbeat` con versión, última sync,
   pendientes y salud de cada reloj.
5. **UI**: estado del agente y de cada reloj, cola pendiente, errores, logs
   exportables, "Sincronizar ahora", "Probar reloj", rotar token, intervalo de
   chunk y arranque con el sistema.

## Seguridad

- El token de dispositivo se guarda **cifrado** con `safeStorage` de Electron
  (Keychain/DPAPI/libsecret) cuando el SO lo permite; si no, queda en claro en
  `userData` y la UI debe tratarse como equipo confiable. En BD solo vive su
  hash SHA-256.
- La ventana usa `contextIsolation`, sin `nodeIntegration`; el preload expone
  solo las operaciones de la UI. El token nunca se manda a la ventana.
- Revocar = `UPDATE agents SET active = false` (el API corta en la siguiente
  petición); rotar = `POST /agent/token` (el token anterior muere).
- El agente acepta `https` con el certificado autofirmado del reloj, igual que
  el API (conexión cifrada, sin validar identidad del equipo).

## Estructura

```
agent/
  electron/
    main.cjs            proceso principal: ventana + IPC + arranque del servicio
    preload.cjs         puente seguro con la UI
    agent-service.cjs   ciclo leer→encolar→subir→jobs→heartbeat
    sync-core.cjs       núcleo puro (ventanas, dedupe, cursor, backoff)
    isapi.cjs           cliente ISAPI (Digest, lecturas y escrituras)
    config-store.cjs    config + cola local en userData
    logger.cjs          log en memoria + archivo rotado + export
    sync-core.test.cjs  unit del núcleo (node:test, sin Electron)
  src/                  UI React (tema TimeManager)
  resources/icon.png        icono de la app
```

## Pruebas

```bash
cd agent && pnpm test    # 10 tests del núcleo de sync (node:test)
```
