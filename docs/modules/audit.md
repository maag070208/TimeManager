# audit — Bitácora de auditoría

Consulta de la bitácora (`AuditLog`): quién hizo qué, cuándo y sobre qué registro. Es la base de la trazabilidad que exige la NOM.

## Endpoints

`GET /` (lista con filtros: `action`, `entityType`, `entityId`, `userId`, `start`, `end`, paginado), `GET /:id` (detalle). El filtro `entityId` permite pedir el historial completo de un registro concreto (p. ej. `?entityType=TimeClockPunch&entityId=<punchId>`).

## Modelos

`AuditLog`.

## Permisos

`audit.view`.

## Dependencias

Lo alimentan otros módulos vía `AuditLogger` (servicio de `users` / `core`); este módulo solo expone la consulta.

## Notas multi-tenant

- **Cobertura NOM (F2-02)**: ya están auditados los ajustes de checadas (`PUNCH_ADJUSTMENT_REQUESTED`, `PUNCH_ADJUSTMENT_APPROVED`, `PUNCH_ADJUSTMENT_REJECTED`, `PUNCH_DISCREPANCY_REPORTED`), cada decisión de tiempo extra (`OVERTIME_APPROVAL_DECISION`, con estado anterior/nuevo por persona y día), la configuración de límites/retención (`NOM_SETTINGS_UPDATED`), las alertas de jornada (`WORKDAY_LIMIT_ALERT`) y el archivado (`NOM_RETENTION_ARCHIVED`). Detalle en [nom](nom.md) y [overtime](overtime.md).
- Crece sin parar: retención configurable por tenant y archivado frío (tabla particionada por fecha o export a storage).
- En SaaS hay dos niveles: auditoría del cliente (ve su propio tenant) y auditoría de plataforma (operadores del SaaS: altas de tenants, cambios de plan) — tablas separadas.
