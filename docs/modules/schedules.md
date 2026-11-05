# schedules — Horarios, asistencia y nómina

El motor de cálculo del sistema: define horarios, los asigna a empleados y convierte checadas/eventos en asistencia (retardo, falta, horas extra). Sin este módulo no existe el reporte de asistencia.

## Qué hace

- **Horarios**: CRUD de `Schedule` con días (`ScheduleDay`).
- **Asignaciones**: `ScheduleAssignment` por empleado con vigencia (`validFrom`); consulta y baja.
- **Asistencia calculada**: `computeWorkday` deriva retardo, horas extra y faltas cruzando el horario asignado con checadas (`POST /attendance/time-clock`) o eventos de acceso (`POST /attendance/access`). `POST /weekly-attendance` para la vista semanal.
- **Tiempo extra calculado**: `POST /overtime/query` y `POST /overtime/export` (lo que alimenta la aprobación en `overtime`).
- **Cierre de nómina**: revisión por departamento (`PayrollDepartmentReview`), cierre y reapertura de semana (`PayrollWeekClosure`).

## Endpoints (agrupados)

| Grupo | Rutas |
|---|---|
| Horarios | `GET/POST /`, `PATCH /:id`, `DELETE /:id`, `GET /:id/assignees` |
| Asignaciones | `POST /assignments`, `POST /assignments/remove`, `POST /assignments/query` |
| Asistencia | `POST /attendance/time-clock`, `POST /attendance/access`, `POST /weekly-attendance` |
| Tiempo extra | `POST /overtime/query`, `POST /overtime/export` |
| Nómina | `GET /payroll/review-state`, `GET /payroll/closures`, `PUT /payroll/reviews`, `POST /payroll/reviews/mark-all`, `POST /payroll/close`, `POST /payroll/reopen` |

## Modelos

`Schedule`, `ScheduleDay`, `ScheduleAssignment`, `PayrollWeekClosure`, `PayrollDepartmentReview`.

## Permisos

`schedules.manage`, `attendance.view`, `payroll.view`, `payroll.close`.

## Frontend

`pages/schedules/*`, `features/schedule/*` (assign, schedules-table, weekly-attendance), `entities/schedule`, widgets de reportes de asistencia. App móvil: `PayrollScreen.kt`.

## Dependencias

- `time-clock` y `access`: fuentes de marcajes para el cálculo.
- `users` / `departments`: alcance de los cálculos y revisiones por departamento.

## Notas multi-tenant

- El cálculo es CPU-bound y por cliente: candidato a cola de trabajos (job por tenant/semana) cuando crezca el volumen.
- Reglas de jornada (tope 12 h diarias, 46 h en 2027, reducción a 40 h en 2030) deben ser **configurables por tenant** (cada cliente puede tener reglas distintas mientras la ley lo permita).
- El cierre de nómina es la frontera de integración: en SaaS, exportar por cliente (API/webhook) en vez de acoplar a una nómina interna.
- **Bug conocido**: retardo mal calculado en pantalla (caso DEMO-911) — revisar `computeWorkday` y la asignación vigente antes de vender el reporte.
