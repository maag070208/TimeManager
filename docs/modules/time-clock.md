# time-clock — Relojes y checadas

El módulo más grande del sistema (47 rutas). Gestiona los relojes físicos tipo ZKTeco, la sincronización de checadas, el vínculo entre números de reloj y empleados, la biometría (huella/foto) y la carga de personal al reloj (roster).

## Qué hace

- **Relojes**: alta/baja/edición por número de serie, credenciales propias por reloj (cifradas, write-only), settings, bitácora de eventos de sync, inspección (overview, usuarios, tarjetas, eventos, cámara).
- **Checadas**: importación y sincronización desde el reloj, consulta con filtros (`POST /query`), resumen, estado del servicio.
- **Personas del reloj**: vínculo `employeeNo` ↔ usuario (`TimeClockEmployee`), sugerencias de vínculo, alta/baja de personas en el reloj físico, tarjetas RFID, fotos.
- **Biometría**: estación de captura de huella, estado por empleado, captura y aplicación al reloj.
- **Roster**: carga masiva de personal al reloj (`TimeClockRosterRun` + `TimeClockRosterEntry`), con categoría de baja (`RemovalCategory`) obligatoria al dar de baja.
- **Reportes**: `POST /report` y `POST /report/export` de checadas.

## Endpoints (agrupados)

| Grupo | Rutas |
|---|---|
| Checadas | `POST /query`, `POST /import`, `POST /sync`, `GET /summary`, `GET /status` |
| Relojes | `POST /clocks`, `PATCH/DELETE /clocks/:serial`, `GET /clocks/:serial/settings|events|inspect/*` |
| Estación de huellas | `GET/PUT /fingerprint-station/config` (solo plataforma), `GET /fingerprint-station`, `POST /fingerprint-station/test` |
| Personas | `GET /people/unified`, `GET/POST /clocks/:serial/people`, `GET/PATCH/DELETE /clocks/:serial/people/:employeeNo`, tarjetas y fotos |
| Empleados | `POST /employees/query`, `POST /employees/link-suggested`, `GET /employees/:userId/clock-status`, alta/baja en reloj (`clock-alta*`, `clock-baja-all`), huella (`fingerprint/*`) |
| Roster | `GET /roster`, `POST /roster/run` |
| Catálogo | `GET/POST /removal-categories`, `PATCH /removal-categories/:id` |
| Reportes | `POST /report`, `POST /report/export` |

## Modelos

`TimeClock` (reloj físico/serie; `username` + `passwordEncrypted` desde F1B-10), `FingerprintStationConfig` (estación de huellas por alcance), `TimeClockPunch` (checada), `TimeClockEmployee` (vínculo reloj↔usuario), `TimeClockSyncEvent` (bitácora de sync), `TimeClockRosterRun` + `TimeClockRosterEntry` (cargas), `RemovalCategory` (catálogo de bajas).

## Credenciales del reloj (F1B-10)

Cada reloj se conecta con **su propio** usuario y contraseña, no con un par global:

- `TimeClock.username` guarda el usuario; `TimeClock.passwordEncrypted` la contraseña cifrada con AES-256-GCM (`api/src/core/utils/crypto.ts`: `encryptSecret`/`decryptSecret`).
- Clave: `ENCRYPTION_KEY` (base64, 32 bytes). Si no está definida se **deriva de `JWT_SECRET` con HKDF-SHA256** y se escribe un warning una sola vez; en producción conviene fijarla (rotar `JWT_SECRET` con esa derivación deja ilegibles los secretos guardados).
- Alta: `POST /time-clock/clocks` acepta `username` y `password` opcionales (los dos o ninguno; se validan contra el equipo antes de guardarlo). Edición: `PATCH /time-clock/clocks/:serial` acepta `username` y/o `password`; la contraseña puede cambiarse sola (mismo usuario) o junto con el usuario.
- **Write-only**: ni el alta, la edición, `GET /time-clock/status` ni ningún endpoint devuelven la contraseña, solo `username` y `hasCredentials: boolean` (el usuario efectivo y si hay con qué conectar). Tampoco se escribe en la bitácora (`metadata` solo lleva `username` y `credentialsChanged`).
- **Fallback de desarrollo/E2E**: si el reloj no tiene credenciales propias se usa el par global `TIME_CLOCK_USER/PASS` (o los viejos `CHECADOR_USER/PASS`). La precedencia es siempre reloj → `.env`; `503 TIME_CLOCK_NOT_CONFIGURED` solo aparece cuando no hay ni credenciales del reloj ni del `.env`. El alta sin credenciales propias también usa el fallback.
- `POST /time-clock/sync` prueba las credenciales del reloj antes de responder: si el equipo las rechaza devuelve `502 TIME_CLOCK_INVALID_CREDENTIALS` al instante (un reloj caído sigue respondiendo 202 y el fallo queda en su bitácora).
- Migración: `api/prisma/migrations/20261106000000_clock_credentials/migration.sql` (`ALTER TABLE time_clocks ADD COLUMN ...`), con rollback en la misma carpeta. Backfill: los relojes ya dados de alta no necesitan cambios; siguen con el par global hasta que se les capturen las suyas.

## API key del reloj (F1B-06)

Además del usuario/contraseña de administración (para la sync de solo lectura),
cada reloj puede tener una **API key para ingesta directa** de checadas:

- `POST /time-clock/clocks/:serial/key` (permiso `time_clocks.manage`) genera o
  rota la key. Se muestra **una sola vez**; en BD solo queda el hash SHA-256
  (`apiKeyHash`, único), el prefijo visible (`apiKeyPrefix`) y la fecha.
- `POST /time-clock/ingest` (sin JWT) recibe `{ serial, punches[] }` y se
  autentica con `X-Clock-Key: tmc_…` (o `Authorization: Bearer`). La fila
  `TimeClock` ata serial + key + `tenantId`: la ingesta corre en el contexto del
  cliente dueño y es idempotente por `@@unique(clockSerial, serialNo)`.
- Errores: `401 INVALID_CLOCK_KEY` si la key no existe/está revocada o es de
  otro serial. Rate limit compartido con `/query|/sync|/import`.
- Convive con la sync por pull: si el reloj sube por ingesta directa, no hace
  falta habilitar además la sync de ese equipo (el cursor no se modifica).

## Estación de huellas (F1B-12)

- `FingerprintStationConfig` guarda una fila por alcance: `tenantId = null` es la **estación central** de TimeManager y una fila con `tenantId` es el **override del cliente** (estación instalada en su sitio). La contraseña va cifrada (AES-256-GCM) y la API nunca la devuelve.
- Resolución en cada captura: override del cliente → estación central → `FINGERPRINT_STATION_*` del `.env` (fallback de desarrollo/E2E). No hace falta reiniciar: `GET /time-clock/fingerprint-station` informa `{configured, url, source, hasPassword}` del cliente en contexto.
- Edición **solo plataforma** (`time_clocks.manage` + usuario sin cliente): `GET/PUT /time-clock/fingerprint-station/config` con `tenantId` opcional (omitido = central) y `clear` para borrar el override. `POST /fingerprint-station/test` captura un dedo con la estación efectiva y descarta la plantilla.
- El enrolamiento (`POST /employees/:userId/fingerprint/capture|apply`) usa la estación efectiva; funciona igual con estación central o en sitio.

## Permisos

`time_clock.view`, `time_clock.write`, `time_clocks.manage`, `time_clock.link` (vincular personas).

## Frontend

`pages/access/*` (TimeClock*), `features/access/time-clock*` (report, employees, differences, inspect, people, roster, clocks, camera), `entities/time-clock`, `widgets/time-clock-dashboard`, `widgets/employee-clock`. App móvil: `TimeClockEntriesExitsScreen.kt`.

## Dependencias

- `users`: vínculo empleado y `AuditLogger`/`deactivate` del servicio de usuarios.
- `schedules`: sin horarios no hay retardo ni horas extra calculadas sobre las checadas.
- `core/services/storage`: fotos de personas del reloj.

## Notas multi-tenant

- **Serial del reloj**: hoy es la llave natural; en SaaS cada reloj pertenece a un cliente → `tenantId` en `TimeClock` y unicidad por tenant.
- **Las checadas son la tabla de mayor volumen**: candidata #1 a índices por `(tenantId, userId, fecha)` y a particionado por fecha.
- **Inmutabilidad NOM (F2-01, implementado)**: `time_clock_punches` es append-only por trigger de BD: el punch no se edita ni se borra; las correcciones son `PunchAdjustment` ligados (motivo, valor anterior/nuevo, solicitante y aprobador), con historial auditable en `GET /nom/punches/:id/history`. Ver [nom](nom.md). El único DELETE permitido es la purga controlada del archivado por retención (F2-04).
- Biometría y fotos son datos sensibles: cifrado en reposo, consentimiento y paths de storage prefijados por tenant.
