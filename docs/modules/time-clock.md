# time-clock — Relojes y checadas

El módulo más grande del sistema (47 rutas). Gestiona los relojes físicos tipo ZKTeco, la sincronización de checadas, el vínculo entre números de reloj y empleados, la biometría (huella/foto) y la carga de personal al reloj (roster).

## Qué hace

- **Relojes**: alta/baja/edición por número de serie, settings, bitácora de eventos de sync, inspección (overview, usuarios, tarjetas, eventos, cámara).
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
| Personas | `GET /people/unified`, `GET/POST /clocks/:serial/people`, `GET/PATCH/DELETE /clocks/:serial/people/:employeeNo`, tarjetas y fotos |
| Empleados | `POST /employees/query`, `POST /employees/link-suggested`, `GET /employees/:userId/clock-status`, alta/baja en reloj (`clock-alta*`, `clock-baja-all`), huella (`fingerprint/*`) |
| Roster | `GET /roster`, `POST /roster/run` |
| Catálogo | `GET/POST /removal-categories`, `PATCH /removal-categories/:id` |
| Reportes | `POST /report`, `POST /report/export` |

## Modelos

`TimeClock` (reloj físico/serie), `TimeClockPunch` (checada), `TimeClockEmployee` (vínculo reloj↔usuario), `TimeClockSyncEvent` (bitácora de sync), `TimeClockRosterRun` + `TimeClockRosterEntry` (cargas), `RemovalCategory` (catálogo de bajas).

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
- **Inmutabilidad NOM**: las correcciones no deben sobrescribir el punch; crear registro de ajuste ligado (`originalPunchId`, motivo, autor). Es el hueco principal para la NOM.
- Biometría y fotos son datos sensibles: cifrado en reposo, consentimiento y paths de storage prefijados por tenant.
