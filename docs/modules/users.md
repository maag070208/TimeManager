# users — Usuarios y empleados

CRUD de usuarios del sistema (que también son los empleados), importación masiva, activación/baja con motivo y permisos directos por usuario.

## Qué hace

- **Consulta**: tabla paginada (`POST /query`), lista, detalle, disponibilidad de username/email, selector de empleados (`GET /employees`, solo con alguno de `schedules.view`, `time_clock.view` o `hr.records`: son las pantallas que lo consumen).
- **Ciclo de vida**: crear, editar, cambio de contraseña, desactivar/reactivar (baja lógica con `deactivatedAt`, autor, motivo y categoría del catálogo `RemovalCategory`), borrado.
- **Importación**: alta masiva por archivo (`POST /import`).
- **Historial**: `GET /:id/history` (timeline + audit-log).
- **Permisos directos**: grant/revoke por usuario encima de los roles.

## Endpoints

`GET /employees` (uno de `schedules.view`/`time_clock.view`/`hr.records`), `POST /query`, `POST /availability`, `GET /`, `GET /:id`, `GET /:id/history`, `POST /`, `POST /import`, `PUT /:id`, `PUT /:id/password`, `PATCH /:id/deactivate`, `PATCH /:id/reactivate`, `DELETE /:id`, `GET /:id/permissions`, `PUT/DELETE /:id/permissions/:permission`.

## Modelos

`User`, `Role`, `UserRole`, `UserPermission`, `RemovalCategory`.

## Permisos

`users.view`, `users.create`, `users.edit`, `users.delete`, `users.permissions`; `hr.records` también permite bajas de personal.

## Frontend

Una persona = una cuenta: **no hay pantalla de Usuarios**, todo vive en **Personal** (`/employees`).

- Lista: `pages/employees/EmployeesListPage` + `features/user/employees-list`. Con `hr.records` lee el expediente (`/hr/query`); con solo `users.view` (SUPPORT) lee las cuentas (`/users/query`), sin datos sensibles. Misma tabla.
- Por fila: ver, editar expediente y menú "⋯" (`features/user/account-actions`): cuenta (usuario, rol, correo), contraseña, baja con motivo, reactivar, eliminar (con forzado si hay historial).
- Rutas: `/employees/new`, `/employees/import`, `/employees/:id/account` (diálogo de cuenta sobre la lista), `/employees/:id/history`. Las viejas `/users/*` redirigen.
- `entities/user`, `features/user/user-form`, `user-history`, `import-users`, `user-permissions`.

## Roles por cliente

`isRoleAllowedFor` (`core/permissions/roles.ts`): el personal de un cliente solo puede tener roles de cliente (`staff`: CLIENT_ADMIN, HUMAN_RESOURCES, CLIENT_STAFF). ADMIN/SUPPORT son de plataforma; darlos a alguien de un cliente le abriría la matriz de roles y la configuración, que son de todos. Se valida en alta, edición (con el cliente del usuario editado) y "agregar miembro" de la consola de roles → 403 `ROLE_NOT_FOR_CLIENT`. La web tampoco los ofrece dentro de un cliente.

## Notas multi-tenant

- `User` es la raíz de todo: **toda tabla cuelga de aquí**, así que el `tenantId` de `User` es el eje del aislamiento.
- `username`, `email` y `employeeNumber` son únicos globales → pasar a únicos por tenant (`@@unique([tenantId, username])`).
- El campo `company` (texto libre) muere: se reemplaza por la relación real al tenant.
- La importación masiva es el onboarding del personal de cada cliente: validar límites por plan (N empleados).
