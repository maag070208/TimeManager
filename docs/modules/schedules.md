# schedules — Horarios, asistencia y nómina

El motor de cálculo del sistema: define horarios, los asigna a empleados y convierte checadas/eventos en asistencia (retardo, falta, horas extra). Sin este módulo no existe el reporte de asistencia.

## Qué hace

- **Horarios**: CRUD de `Schedule` con días (`ScheduleDay`).
- **Asignaciones**: `ScheduleAssignment` por empleado con vigencia (`validFrom`); consulta y baja. Una persona solo puede tener **una asignación abierta** (`validTo = null`) a la vez: un índice único parcial lo garantiza y al asignar un horario se cierra/elimina la asignación abierta anterior. Si un día tiene varias asignaciones vigentes encimadas (una corrección/reasignación hacia atrás que no cerró a la anterior), el horario del día se resuelve con la que **entró en vigor al final** (empate: la capturada después y el id), nunca con la más antigua.
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

## Cálculo de jornada (`computeWorkday`)

Una sola regla para Entradas y salidas, Pre nómina (= asistencia semanal) y Horas extra; vive en `services/workday-rules.ts` y recibe el día local, las sesiones del reloj, el horario vigente y la zona del cliente.

- **Retardo** (`lateMin`): primera entrada del día contra la entrada programada del primer tramo; solo cuenta si supera `entryToleranceMin`. Se expresa en minutos (359 = "5:59"); llegar antes nunca genera retardo negativo. Un día de descanso, un día sin `ScheduleDay` o una persona sin horario asignado **no inventa** retardo.
- **Tiempo extra**: solo lo trabajado de verdad después de la salida programada del último tramo (una sesión que empieza después no hereda el hueco intermedio) (o de la salida del turno + 24 h si cruza medianoche), menos `exitToleranceMin` y si alcanza `minOvertimeMin`. En descanso cuenta todo lo trabajado; sin horario no se calcula (se marca `withoutSchedule`).
- **Faltante** (`missingMin`): lo programado menos lo trabajado, solo si hubo checada.
- **Vacaciones y permisos**: un día con solicitud aprobada y sin checadas sale como `LEAVE` (no es falta ni suma faltante).
- Las checadas web/app llegan en las sesiones del reporte del reloj (con sus ajustes); la asistencia semanal no las vuelve a sumar.
- **Pre-nómina cerrada**: con la semana cerrada no cambian revisiones ni se asignan horarios con fecha dentro o antes de ella (`409 PAYROLL_WEEK_CLOSED`); cerrar exige departamentos del cliente y al menos uno. Las fechas de los DTO deben existir en el calendario.
- **Asignación del día**: `scheduleOn` elige la asignación vigente; con vigencias encimadas gana la más reciente (ver "Qué hace"). El caso **DEMO-911** ("Retardo 5:59 h" con entrada 14:58 y turno Vespertino 15:00) era esto: se comparaba contra un Matutino 09:00 de una asignación vieja que nunca se cerró. Resuelto en F2-05; regresión en `workday-rules.test.ts` y `tests/integration/schedules-late.flow.test.ts`.

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
- **Resuelto (F2-05)**: el retardo mal calculado de DEMO-911 venía de la resolución de la asignación (ganaba la vigencia más antigua) y ya usa la más reciente; el cálculo en sí (`computeWorkday`) siempre estuvo bien.

## Semana laboral configurable por cliente

- `Tenant.weekStartDay` (0=domingo … 6=sábado; default 3=miércoles) define el borde de la semana para horarios, pre-nómina, tiempo extra, asistencia y bitácoras.
- El administrador del cliente lo cambia en **Configuración del cliente** (`/settings/general`), que guarda vía `PUT /nom/config { weekStartDay }` y refresca la sesión.
- El API resuelve la semana por cliente en `ScheduleService`, `WeeklyAttendanceService`, reporte de reloj y bitácora; el `sys_config.WEEK_START_DAY` queda solo como fallback.

## Validación legal y transición 2027 (F2)

- **H-02:** `POST /schedules` y `PATCH /schedules/:id` validan la semana contra el tope legal del año (`validateScheduleLegality`): rechazan 400 `SCHEDULE_ILLEGAL` si la semana ordinaria pasa del máximo (48/46/44/42/40 h) o si no hay día de descanso. Devuelven avisos (no bloquean) por jornada diaria arriba del estándar del turno o descanso no declarado.
- **H-03:** `GET /schedules/legal-transition?year=YYYY` lista los horarios activos que dejan de ser legales en ese año, con minutos semanales, tope legal, infracciones, avisos, jornada diaria máxima y personas asignadas (para ajustar antes del 1-ene sin bajar salario).
- El tipo de turno del art. 60 (`shiftTypeOf`) se calcula por día y viaja en el cálculo de jornada.
