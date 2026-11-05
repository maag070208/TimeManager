# permissions — Roles, permisos y políticas

Sistema de autorización: catálogo de permisos, roles con matriz de permisos, roles extra por usuario, políticas con condiciones y simulador de acceso.

## Qué hace

- **Roles**: CRUD de roles, miembros (asignar/quitar), matriz rol↔permiso (`PUT /matrix`).
- **Catálogo**: alta de permisos (`POST /catalog`), catálogo activo y recarga en caliente (`POST /reload`).
- **Políticas**: CRUD de `Policy` con condiciones (`PolicyCondition`) y roles afectados (`PolicyRole`).
- **Diagnóstico**: `POST /simulate` (qué puede hacer un usuario), `GET /members/:userId/access`, actividad y panel admin.

## Endpoints

`GET /roles`, `GET /catalog`, `POST/PATCH/DELETE /roles/:key`, `GET/POST/PATCH/DELETE /policies*`, `GET /members`, `GET /members/:userId/access`, `PUT/DELETE /roles/:key/members/:userId`, `POST /simulate`, `POST /activity/query`, `GET /admin`, `PUT /matrix`, `POST /catalog`, `POST /reload`.

## Modelos

`Role`, `UserRole`, `Permission`, `RolePermission`, `UserPermission`, `Policy`, `PolicyCondition`, `PolicyRole`.

## Permisos

`roles.manage` para todo lo administrativo; catálogo y roles legibles con sesión.

## Frontend

`pages/roles/*`, `features/roles`, `entities/permission`, guardas `RequiresPermission` en `app/guards/PrivateRoutes.tsx`.

## Notas multi-tenant

- Diseño de dos capas: **catálogo de permisos global** (lo define el producto) y **roles por tenant** (cada cliente crea los suyos). Los roles base del sistema (ADMIN, EMPLOYEE…) se clonan como plantilla al crear el tenant.
- Las políticas con condiciones son el lugar natural para límites por plan (p. ej. máximo de relojes o de empleados).
- `roles.manage` pasa a ser permiso del admin del tenant, no del operador del SaaS.
