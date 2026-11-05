# tenants — Clientes de la plataforma

Alta, consulta y suspensión de clientes (tenants) del SaaS. Solo personal de plataforma (usuarios sin `tenantId`); un usuario de cliente recibe 403 aunque tenga una excepción de permiso.

## Endpoints

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `GET` | `/tenants` | `tenants.view` | Lista de clientes con `usage.activeUsers` |
| `GET` | `/tenants/:id` | `tenants.view` | Un cliente |
| `POST` | `/tenants` | `tenants.manage` | Crea cliente + su `CLIENT_ADMIN` (`mustChangePassword`) + catálogos plantilla. Sin `admin.password` genera una provisional y la devuelve **una sola vez** en `temporaryPassword` |
| `PATCH` | `/tenants/:id` | `tenants.manage` | Cambia `status` (ACTIVE/SUSPENDED), `name`, `timezone`, `plan`, `employeeLimit` |

- `slug` = subdominio: minúsculas, números y guiones (máx. 40), normalizado a minúsculas. Reservados: `app`, `admin`, `api`, `www`, `static`, `cdn`, `mail`. Repetido → 409 `TENANT_SLUG_TAKEN`.
- Suspender corta en caliente: el login con ese slug da 403 `TENANT_SUSPENDED`, las sesiones vivas también (middleware `authenticate`) y el `X-Tenant-Id` de plataforma hacia ese cliente da 400 `INVALID_TENANT_HEADER`.
- Auditoría: `TENANT_CREATED`, `TENANT_UPDATED`, `TENANT_SUSPENDED`, `TENANT_REACTIVATED` (bitácora de plataforma, `tenantId` null).

## Permisos

`tenants.view` (ADMIN, SUPPORT) y `tenants.manage` (ADMIN), módulo "Plataforma" en `api/prisma/seed-data/permissions.json`. Se siembran insert-missing al arrancar.

## Modelos

`Tenant`; crea un `User` (`CLIENT_ADMIN`) y copia `RemovalCategory`/`DocumentType` desde `seed-data/tenant_template_catalogs.json` (`seedTenantTemplateCatalogs`).

## Frontend

- `entities/tenant` (tipos + `tenantApi`).
- `features/tenant/tenant-switcher`: en la barra superior. Usuario de cliente: nombre de su empresa. Plataforma con `tenants.view`: selector de cliente; la elección se guarda en `localStorage` (`tm_selected_tenant_v1`), viaja como `X-Tenant-Id` (interceptor en `shared/api/client.ts`) y recarga la app al cambiar. Un `X-Tenant-Id` rechazado borra la elección.
- Login: el slug sale del subdominio (`shared/api/tenant.ts`, `tenantSlugFromHost`): `acme.localhost:5006` en local, `acme.<VITE_TENANT_BASE_DOMAIN>` en producción; `app.`/`admin.`/`www.` o sin subdominio = plataforma.
- Consola de plataforma en `/` (sin cliente elegido): `pages/home/PlatformHomePage` + `features/tenant/tenants-console` (tabla, alta guiada, entrar, suspender/reactivar).
- `useClientContext` (`features/tenant/tenant-switcher`): `isPlatform`, `client` y `platformWithoutClient`. Sin cliente elegido solo se abren `PLATFORM_PATHS` (`/`, `/notifications`, `/roles`).

## Notas multi-tenant

- El servicio corre todo en `runWithTenant(null, …, true)`: la tabla `tenants` y los conteos son de plataforma aunque ADMIN venga con `X-Tenant-Id`.
- CORS: `WEB_ORIGIN` acepta lista separada por comas y comodín de subdominio (`http://*.localhost:5006`, `https://*.timemanager.mx`) — `api/src/core/config/cors-origin.ts`.
