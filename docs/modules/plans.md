# plans — Catálogo de planes del SaaS

Planes que la plataforma ofrece a sus clientes (F3-09/10/11 de
[ESTADO_DEL_PLAN](../ESTADO_DEL_PLAN.md) §3): nombre, **límite de personal**,
**límite de relojes** y **precio mensual de lista**. El cobro todavía es manual
(pospuerto D5): aquí solo viven los datos y el **enforcement de los límites**.

## Endpoints

Todos son **solo de plataforma** (usuarios sin cliente): un usuario de cliente
recibe 403 aunque tenga una excepción de permiso (`requiresPlatform`).

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `GET` | `/plans` | `plans.view` | Catálogo activo (`?includeInactive=true` incluye las bajas) |
| `GET` | `/plans/:id` | `plans.view` | Un plan |
| `POST` | `/plans` | `plans.manage` | Alta: `name`, `employeeLimit`, `clockLimit`, `monthlyPrice?`, `key?`, `sortOrder?` |
| `PATCH` | `/plans/:id` | `plans.manage` | Edición de nombre, límites, precio, orden y `active` |
| `DELETE` | `/plans/:id` | `plans.manage` | **Baja lógica** (`active=false`): los clientes que lo tienen lo conservan |

- La `key` es estable y no se edita: si no se manda, se deriva del nombre
  (`Básico` → `BASICO`). Duplicada → 409 `PLAN_KEY_TAKEN`.
- Planes de arranque (`api/prisma/seed-data/plans.json` y la migración
  `20261107000100_plans`): `PLAN_500` (500 personas / 1 reloj / $500),
  `PLAN_750` (750 / 2 / $750) y `PLAN_1000` (1000 / 3 / $1000).
- Asignación: `PATCH /tenants/:id` con `planId` (o `null` para dejarlo sin
  plan). Un plan inexistente → 404 `PLAN_NOT_FOUND`; uno dado de baja → 409
  `PLAN_INACTIVE`. **Bajar de plan no borra nada**: si el uso queda por encima
  del límite, la ficha lo muestra en rojo y solo se bloquean altas nuevas.
- Auditoría: `PLAN_CREATED`, `PLAN_UPDATED`, `PLAN_DEACTIVATED`,
  `PLAN_REACTIVATED` y `TENANT_UPDATED` (con `planId` anterior/nuevo).

## Enforcement (F3-10)

`api/src/core/plans/limits.ts` resuelve los límites efectivos y cuenta el uso:

- **Personal** = `User.active = true` del cliente. Límite = override explícito
  `Tenant.employeeLimit` si existe; si no, `Plan.employeeLimit`; sin plan no
  hay límite.
- **Relojes** = `TimeClock.url != null` (dados de alta). Límite =
  `Plan.clockLimit`; sin plan no hay límite.

Se aplica en:

| Punto | Helper | Error |
|---|---|---|
| Alta individual `POST /users` | `assertCanAddPeople` | 409 `EMPLOYEE_LIMIT_REACHED` |
| Importación Excel `POST /users/import` | `assertCanAddPeople(tenantId, rows.length)` (todo o nada) | 409 `EMPLOYEE_LIMIT_REACHED` |
| Alta del cliente `POST /tenants` (su `CLIENT_ADMIN`) | `assertPeopleCapacity` con el plan elegido | 409 `EMPLOYEE_LIMIT_REACHED` |
| Alta de reloj `POST /time-clocks` | `assertCanAddClock` | 409 `CLOCK_LIMIT_REACHED` |

Los errores traen **uso y límite** en el mensaje i18n
(`api/src/core/i18n/messages/{es,en}.ts`). Dar de baja a una persona o retirar
un reloj libera lugar.

## Modelos

- `Plan` (`plans`): `key` único, `name`, `employeeLimit`, `clockLimit`,
  `monthlyPrice Decimal?(12,2)`, `active`, `sortOrder`.
- `Tenant.planId` → `Plan` (`ON DELETE SET NULL`). La columna vieja
  `Tenant.plan` (texto libre) se eliminó con **backfill** en la migración:
  `PLAN_500`/`PLAN_750`/`PLAN_1000` (o el nombre del plan) pasan a la FK; una
  etiqueta desconocida deja al cliente sin plan (sin límites) y la consola
  permite asignarle uno.

## Permisos

`plans.view` (ADMIN, SUPPORT) y `plans.manage` (ADMIN), módulo "Plataforma" en
`api/prisma/seed-data/permissions.json` y la matriz en `role_permissions.json`.
Se siembran insert-missing al arrancar.

## Frontend

- `entities/plan` (tipos + `planApi`).
- `pages/plans/PlansPage` en `/plans` (guard `plans.view`): listado del catálogo
  con nombre/clave, límites, precio y estado; alta/edición (`PlanFormDialog`) y
  baja/reactivación con confirmación (`TicConfirm`).
- Consola de clientes (`pages/home/PlatformHomePage`): columnas de personas y
  relojes contra su límite (en rojo si se rebasó), nombre del plan y acción
  **Plan** (`PlanAssignDialog`) con selector, uso actual y aviso de exceso.
  El alta de cliente también elige plan (`CreateTenantDialog`).
- Menú: pantalla `plans` en `entities/permission/model/screens.ts`; `/plans` es
  una ruta de plataforma (`PLATFORM_PATHS`).

## Notas multi-tenant

`Plan` es una tabla de plataforma (sin `tenantId`): no la filtra la extensión de
tenancy y solo se administra desde la consola. Los conteos de uso se hacen por
`tenantId` explícito y corren fuera del contexto de cliente en la ficha.

## Pruebas

- Integración: `api/tests/integration/plans.flow.test.ts` (BD `tm_test_plans`).
- Unitarias: `api/src/core/plans/fixtures.test.ts` (planes de arranque).
