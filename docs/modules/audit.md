# audit — Bitácora de auditoría

Consulta de la bitácora (`AuditLog`): quién hizo qué, cuándo y sobre qué registro. Es la base de la trazabilidad que exige la NOM.

## Endpoints

`GET /` (lista con filtros), `GET /:id` (detalle).

## Modelos

`AuditLog`.

## Permisos

`audit.view`.

## Dependencias

Lo alimentan otros módulos vía `AuditLogger` (servicio de `users` / `core`); este módulo solo expone la consulta.

## Notas multi-tenant

- **Hueco NOM conocido**: no está garantizada la cobertura sobre checadas (correcciones) ni aprobaciones de tiempo extra. Antes del SaaS hay que cerrar cobertura (ver sección 5 de `../RH_MODULO_STANDALONE.md`).
- Crece sin parar: retención configurable por tenant y archivado frío (tabla particionada por fecha o export a storage).
- En SaaS hay dos niveles: auditoría del cliente (ve su propio tenant) y auditoría de plataforma (operadores del SaaS: altas de tenants, cambios de plan) — tablas separadas.
