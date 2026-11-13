# audit — Bitácora de auditoría

Consulta de la bitácora (`AuditLog`): quién hizo qué, cuándo y sobre qué registro. Es la base de la trazabilidad que exige la NOM.

## Endpoints

`GET /` (lista con filtros: `tenantId`, `module`, `q`, `action`, `entityType`, `entityId`, `userId`, `start`, `end`, paginado), `GET /:id` (detalle). El filtro `entityId` permite pedir el historial completo de un registro concreto (p. ej. `?entityType=TimeClockPunch&entityId=<punchId>`).

Cada registro guarda: cliente, módulo, acción, entidad, usuario, fecha/hora, roles, permisos/excepciones vigentes, IP, user-agent, estado anterior/nuevo y metadatos. El nombre del usuario (`userName`) lo hereda del contexto de la petición cuando el servicio no lo pasa, así la consola no muestra UUIDs. La tabla `audit_logs` es **inmutable**: un trigger de PostgreSQL rechaza `UPDATE` y `DELETE`; la API solo expone lectura.

## Modelos

`AuditLog` (`module`, `permissions`, `roles`, `ipAddress`, `userAgent` además de los campos de operación).

## Permisos

`audit.view` para ADMIN/SUPPORT y CLIENT_ADMIN. El servicio fuerza el `tenantId` del contexto: un usuario de cliente **solo ve los logs de su empresa**; un operador de plataforma ve todos y puede filtrar por cliente. El detalle por id también valida el tenant.

## Dependencias

Lo alimentan otros módulos vía `AuditLogger` (servicio de `users` / `core`); este módulo solo expone la consulta.

## Notas multi-tenant

- **Cobertura NOM (F2-02)**: ya están auditados los ajustes de checadas (`PUNCH_ADJUSTMENT_REQUESTED`, `PUNCH_ADJUSTMENT_APPROVED`, `PUNCH_ADJUSTMENT_REJECTED`, `PUNCH_DISCREPANCY_REPORTED`), cada decisión de tiempo extra (`OVERTIME_APPROVAL_DECISION`, con estado anterior/nuevo por persona y día), la configuración de límites/retención (`NOM_SETTINGS_UPDATED`), las alertas de jornada (`WORKDAY_LIMIT_ALERT`) y el archivado (`NOM_RETENTION_ARCHIVED`). Detalle en [nom](nom.md) y [overtime](overtime.md).
- Crece sin parar: retención configurable por tenant y archivado frío (tabla particionada por fecha o export a storage).
- En SaaS hay dos niveles: auditoría del cliente (ve su propio tenant) y auditoría de plataforma (operadores del SaaS: altas de tenants, cambios de plan). Hoy comparten tabla; el `tenantId` permite separarlas y la consola `/audit` es de plataforma (`audit.view`).
- UI: **Auditoría** (`/audit`) para ADMIN/SUPPORT, con filtros por cliente, persona, módulo, acción, texto y rango de fechas; el detalle muestra accesos, IP, agente y estados. No tiene acciones de edición ni borrado.
