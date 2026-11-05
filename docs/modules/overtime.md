# overtime — Aprobación de tiempo extra

Flujo de aprobación/rechazo del tiempo extra calculado por `schedules`. Es deliberadamente chico (2 rutas): el cálculo vive en `schedules` y aquí solo se decide.

## Qué hace

- `POST /query`: consulta de solicitudes/aprobaciones con filtros.
- `POST /approvals`: aprobar o rechazar tiempo extra (`OvertimeApproval`).

## Modelos

`OvertimeApproval` (quién aprobó, cuándo, qué periodo/horas).

## Permisos

`overtime.view`, `overtime.approve`.

## Frontend

`pages/overtime/*`, `features/schedule/overtime-approval`, `entities/overtime`. Pantalla "Tiempo extra" (`/schedules/overtime/approval`).

## Dependencias

- `schedules`: origen de las horas extra calculadas que se aprueban aquí.
- `audit`: las aprobaciones deben quedar en pista de auditoría (quién, cuándo, qué cambió) — requisito NOM, verificar cobertura actual.

## Notas multi-tenant

- Bajo volumen y 100% por cliente: basta `tenantId` + índice.
- Los límites que disparan alertas (tope diario/semanal) dependen de las reglas por tenant definidas en `schedules`.
