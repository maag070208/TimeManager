# departments — Departamentos y subáreas

La estructura organizacional del cliente: departamentos con subáreas, soft-delete, y base de las revisiones de nómina por departamento.

## Endpoints

Montado en `/departments` y `/subareas` (mismo módulo, rutas espejo): `GET /`, `POST /query`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (soft-delete con `active`).

## Modelos

`Department` (`name` único), `Subarea` (única por `[departmentId, name]`).

## Permisos

`departments.manage` para escribir; lectura libre con sesión.

## Frontend

`pages/departments/*`, `pages/subareas/*`, `features/department`, `features/subarea`, tabs de catálogos en `pages/catalog`.

## Notas multi-tenant

- 100% por cliente: `tenantId` en ambas tablas y unicidad por tenant (`@@unique([tenantId, name])`).
- Bajo volumen y casi sin cambios: sin problemas de escalamiento.
