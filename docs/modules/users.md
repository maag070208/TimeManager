# users — Usuarios y empleados

CRUD de usuarios del sistema (que también son los empleados), importación masiva, activación/baja con motivo y permisos directos por usuario.

## Qué hace

- **Consulta**: tabla paginada (`POST /query`), lista, detalle, disponibilidad de username/email, selector de empleados (`GET /employees`).
- **Ciclo de vida**: crear, editar, cambio de contraseña, desactivar/reactivar (baja lógica con `deactivatedAt`, autor, motivo y categoría del catálogo `RemovalCategory`), borrado.
- **Importación**: alta masiva por archivo (`POST /import`).
- **Historial**: `GET /:id/history` (timeline + audit-log).
- **Permisos directos**: grant/revoke por usuario encima de los roles.

## Endpoints

`GET /employees`, `POST /query`, `POST /availability`, `GET /`, `GET /:id`, `GET /:id/history`, `POST /`, `POST /import`, `PUT /:id`, `PUT /:id/password`, `PATCH /:id/deactivate`, `PATCH /:id/reactivate`, `DELETE /:id`, `GET /:id/permissions`, `PUT/DELETE /:id/permissions/:permission`.

## Modelos

`User`, `Role`, `UserRole`, `UserPermission`, `RemovalCategory`.

## Permisos

`users.view`, `users.create`, `users.edit`, `users.delete`, `users.permissions`; `hr.records` también permite bajas de personal.

## Frontend

`pages/users/*` (lista, nuevo, edición, historial, importación), `features/user/*`, `entities/user`.

## Notas multi-tenant

- `User` es la raíz de todo: **toda tabla cuelga de aquí**, así que el `tenantId` de `User` es el eje del aislamiento.
- `username`, `email` y `employeeNumber` son únicos globales → pasar a únicos por tenant (`@@unique([tenantId, username])`).
- El campo `company` (texto libre) muere: se reemplaza por la relación real al tenant.
- La importación masiva es el onboarding del personal de cada cliente: validar límites por plan (N empleados).
