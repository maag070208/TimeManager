# dashboard — Tableros por rol

Agregaciones read-only para las pantallas de inicio: cada endpoint pide su permiso y el servicio recorta los datos según el alcance del usuario (propio / área / todo).

## Endpoints

El resumen del ERP (`GET /summary` con devices/materialOutputs/inventory) se retiró en L-21 por no tener modelo ni consumidor; el DTO de Swagger asociado también.

`GET /hr-records` (expedientes), `GET /people` (personal), `GET /attendance-today` (asistencia del día), `GET /overtime-week` (tiempo extra de la semana), `GET /setup-gaps` (pendientes de configuración del reloj).

## Permisos

`hr.records`, `attendance.view`, `overtime.view`, `time_clock.link` según el widget.

## Frontend

`pages/home/HomePage`, `features/home/admin-dashboard`, `widgets/time-clock-dashboard`.

## Notas multi-tenant

- No persiste nada: solo necesita que las queries de los módulos fuente ya filtren por tenant.
- Son las queries más leídas del sistema: candidatas a caché corta (p. ej. 60 s por tenant) cuando haya N clientes.
