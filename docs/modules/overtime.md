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
- `audit`: cada decisión escribe `OVERTIME_APPROVAL_DECISION` con `previousState`/`newState` (estado anterior y nuevo, minutos, nota) y `entityId` = persona + día; además del resumen del lote (`OVERTIME_APPROVAL`). Es la pista de auditoría que exige la NOM (F2-02).

## Notas multi-tenant

- Bajo volumen y 100% por cliente: basta `tenantId` + índice.
- Los límites que disparan alertas (tope diario/semanal) se configuran por cliente en el módulo [nom](nom.md) (F2-03), que reutiliza el cálculo de `schedules`.
