# users — Usuarios y empleados

CRUD de usuarios del sistema (que también son los empleados), importación masiva, activación/baja con motivo y permisos directos por usuario.

## Qué hace

- **Consulta**: tabla paginada (`POST /query`), lista, detalle, disponibilidad de username/email, selector de empleados (`GET /employees`, solo con alguno de `schedules.view`, `time_clock.view` o `hr.records`: son las pantallas que lo consumen).
- **Ciclo de vida**: crear, editar, cambio de contraseña, desactivar/reactivar (baja lógica con `deactivatedAt`, autor, motivo y categoría del catálogo `RemovalCategory`), borrado.
- **Importación**: alta masiva por archivo (`POST /import`, `GET /import/template`). Solo `.xlsx`: la lectura es con `exceljs` (`core/utils/xlsxParse.ts`), no con `xlsx` (retirado del runtime por CVE-2023-30533 y CVE-2024-22363).
- **Historial**: `GET /:id/history` (timeline + audit-log).
- **Permisos directos**: grant/revoke por usuario encima de los roles.

## Endpoints

`GET /employees` (uno de `schedules.view`/`time_clock.view`/`hr.records`), `POST /query`, `POST /availability`, `GET /`, `GET /:id`, `GET /:id/history`, `POST /`, `POST /import`, `PUT /:id`, `PUT /:id/password`, `PATCH /:id/deactivate`, `PATCH /:id/reactivate`, `DELETE /:id`, `GET /:id/permissions`, `PUT/DELETE /:id/permissions/:permission`.

## Modelos

`User`, `Role`, `UserRole`, `UserPermission`, `RemovalCategory`.

## Permisos

`users.view`, `users.create`, `users.edit`, `users.delete`, `users.permissions`; `hr.records` también permite bajas de personal. `POST /users/query` exige `users.view`.

Cuentas de administración (`ADMIN`, `SUPPORT`, `CLIENT_ADMIN`): solo otra cuenta de administración da ese rol, edita una cuenta así o le pone contraseña (`403 ADMIN_ACCOUNT_REQUIRES_ADMIN`); nadie cambia su propio rol (`403 CANNOT_CHANGE_OWN_ROLE`). El departamento debe ser del cliente de la persona. Reactivar va por `PATCH /users/:id/reactivate` (revisa el límite del plan); `PUT { active: true }` → `400 USE_REACTIVATE`. Las excepciones de permiso solo se otorgan o retiran a personas del propio cliente.

## Frontend

Una persona = una cuenta: **no hay pantalla de Usuarios**, todo vive en **Personal** (`/employees`).

- Lista: `pages/employees/EmployeesListPage` + `features/user/employees-list`. Con `hr.records` lee el expediente (`/hr/query`); con solo `users.view` (SUPPORT) lee las cuentas (`/users/query`), sin datos sensibles. Misma tabla.
- Por fila: ver, editar expediente y **Acceso** (llave, con `users.edit`): diálogo `UserEditDialog` con usuario, nueva contraseña (vacía = conservar; se guarda con `PUT /users/:id/password`), rol, más el estado de la cuenta: baja con motivo, reactivar y eliminar (con forzado si hay historial; `features/user/account-actions`). Nombre, correo y departamento se editan en el expediente. Los roles adicionales no se capturan desde aquí: se administran en la consola de roles (agregar/quitar miembro de un rol).
- Alta (`/employees/new`): el correo es opcional (se valida solo si se escribe; sin correo no se encolan los avisos que lo requieren) y la documentación del alta es opcional: la sección de documentos se ofrece a los roles con expediente, pero ya no bloquea el alta.
- Rutas: `/employees/new`, `/employees/import`, `/employees/:id/account` (diálogo de cuenta sobre la lista), `/employees/:id/history`. Las viejas `/users/*` redirigen.
- `entities/user`, `features/user/user-form`, `user-history`, `import-users`, `user-permissions`.

## Roles por cliente

`isRoleAllowedFor` (`core/permissions/roles.ts`): el personal de un cliente solo puede tener roles de cliente (`staff`: CLIENT_ADMIN, HUMAN_RESOURCES, CLIENT_STAFF). ADMIN/SUPPORT son de plataforma; darlos a alguien de un cliente le abriría la matriz de roles y la configuración, que son de todos. Se valida en alta, edición (con el cliente del usuario editado) y "agregar miembro" de la consola de roles → 403 `ROLE_NOT_FOR_CLIENT`. La web tampoco los ofrece dentro de un cliente.

## Notas multi-tenant

- `User` es la raíz de todo: **toda tabla cuelga de aquí**, así que el `tenantId` de `User` es el eje del aislamiento.
- `username`, `email` y `employeeNumber` son únicos globales → pasar a únicos por tenant (`@@unique([tenantId, username])`).
- El campo `company` (texto libre) muere: se reemplaza por la relación real al tenant.
- La importación masiva es el onboarding del personal de cada cliente: validar límites por plan (N empleados).
