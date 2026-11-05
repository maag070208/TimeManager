# access — Control de acceso (entradas/salidas)

Registro de eventos de entrada/salida por escaneo (credencial/QR), con sitios geocercados y guardia que registra. Es la fuente alternativa de asistencia cuando el cliente no usa reloj físico.

## Qué hace

- **Eventos**: `POST /events` registra entrada/salida. Cada escaneo es una fila **inmutable**; la jornada se deriva por consulta, nunca se materializa. La anulación es lógica (`voidedAt`/`voidedById`/`voidReason`), jamás DELETE.
- **Consulta**: `POST /query`, `POST /stats`, `GET /status/:employeeId`, `GET /me/today` (portal del empleado), `POST /lookup`.
- **Reportes**: `POST /report` y `POST /report/export`.
- **Sitios**: CRUD de `Site` con geocerca (`latitude`, `longitude`, `radiusMeters`).

## Endpoints

`POST /lookup`, `POST /events`, `GET /status/:employeeId`, `POST /query`, `POST /stats`, `POST /report`, `POST /report/export`, `GET /me/today`, `GET/POST /sites`, `PUT /sites/:id`, `GET /:id`, `POST /:id/void`.

## Modelos

`AccessEvent` (evento inmutable, con snapshots de nombre/número del empleado, `siteId`, `guardId`, geolocalización del marcaje), `Site` (sitio con geocerca).

## Permisos

`access.log` (registrar eventos), `attendance.view` (reportes).

## Frontend

`pages/access/AccessReportPage`, `features/access/report`, `entities/access`, `widgets/employee-credential` (QR).

## Dependencias

- `users`: empleado (sujeto) y guardia (quien registra).
- `schedules`: `POST /schedules/attendance/access` calcula asistencia desde estos eventos.

## Notas multi-tenant

- El diseño inmutable + anulación lógica ya es compatible con la NOM; reutilizar el patrón para correcciones de `time-clock`.
- `Site` pasa a ser por cliente: unicidad de `name`/`code` por tenant y geocercas independientes.
- La geolocalización se limita al momento del marcaje (dato sensible); en SaaS, aviso de privacidad configurable por cliente.
- Volumen alto (cada escaneo es una fila): mismas consideraciones de índices/particionado que `TimeClockPunch`.
