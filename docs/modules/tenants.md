# tenants — Clientes de la plataforma

Alta, consulta y suspensión de clientes (tenants) del SaaS. Solo personal de plataforma (usuarios sin `tenantId`); un usuario de cliente recibe 403 aunque tenga una excepción de permiso.

## Endpoints

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `GET` | `/tenants` | `tenants.view` | Lista de clientes con `plan` (objeto resumido), `limits` (personal/relojes) y `usage` (`activeUsers` + `clocks`) |
| `GET` | `/tenants/:id` | `tenants.view` | Un cliente con plan, límites efectivos y uso |
| `POST` | `/tenants` | `tenants.manage` | Crea cliente + su `CLIENT_ADMIN` (`mustChangePassword`) + catálogos plantilla. Acepta `planId` (el admin debe caber en su límite de personal). Sin `admin.password` genera una provisional y la devuelve **una sola vez** en `temporaryPassword` |
| `PATCH` | `/tenants/:id` | `tenants.manage` | Cambia `status` (ACTIVE/SUSPENDED), `name`, `timezone`, **`planId`** (asignar/cambiar/quitar plan) y el override `employeeLimit` |
| `POST` | `/tenants/:id/impersonate` | `tenants.view` | **Entrar como cliente (F3-03)**: valida que el cliente exista y esté ACTIVE y registra `TENANT_IMPERSONATED`. No cambia la sesión: la operación sigue viajando como `X-Tenant-Id` |

- `slug` = subdominio: minúsculas, números y guiones (máx. 40), normalizado a minúsculas. Reservados: `app`, `admin`, `api`, `www`, `static`, `cdn`, `mail`. Repetido → 409 `TENANT_SLUG_TAKEN`.
- Suspender corta en caliente: el login con ese slug da 403 `TENANT_SUSPENDED`, las sesiones vivas también (middleware `authenticate`) y el `X-Tenant-Id` de plataforma hacia ese cliente da 400 `INVALID_TENANT_HEADER`.
- Auditoría: `TENANT_CREATED`, `TENANT_UPDATED`, `TENANT_SUSPENDED`, `TENANT_REACTIVATED` y `TENANT_IMPERSONATED` (bitácora de plataforma, `tenantId` null; en la impersonación el `metadata` lleva `tenantId`, `slug` y `name` del cliente, y `userId`/`userName` del actor).
- Planes: el catálogo, las reglas de asignación y el enforcement de límites viven en [plans](plans.md). **Bajar de plan no borra datos**: solo bloquea altas nuevas si el uso queda por encima del límite.

## Permisos

`tenants.view` (ADMIN, SUPPORT) y `tenants.manage` (ADMIN), módulo "Plataforma" en `api/prisma/seed-data/permissions.json`. Se siembran insert-missing al arrancar.

## Branding por cliente (F3-05)

- `Tenant.brandColor` (`#RRGGBB`), `Tenant.logoDataUrl` (data URL PNG/JPEG/WebP, máx. ~512 KB decodificados) y `Tenant.emailFrom` (remitente propio; fallback `RESEND_FROM_EMAIL`). Se editan con `PATCH /tenants/:id` (solo plataforma, auditado con valor anterior/nuevo; `null` quita el branding).
- `/auth/me` expone `tenant.brandColor` y `tenant.logoDataUrl`; el login público usa `GET /auth/branding?tenant=<slug>` (sin sesión, devuelve `name`/`brandColor`/`logoDataUrl`, nulls si el cliente no existe).
- Web: el panel de login aplica logo/color/nombre del cliente, el sidebar usa logo/nombre y los **PDFs** (membrete de reportes y credencial) usan nombre/logo/color. La **cola de correo** usa el logo inline y el color del cliente en las plantillas y envía con `emailFrom` (fallback `RESEND_FROM_EMAIL`). **Pendiente:** pantalla de branding en la consola de clientes (hoy por API) y dominio del remitente verificado en Resend.

## Modelos

`Tenant` (datos, plan y branding: `brandColor`, `logoDataUrl`, `emailFrom`; `planId` → `Plan`); crea un `User` (`CLIENT_ADMIN`) y copia `RemovalCategory`/`DocumentType` desde `seed-data/tenant_template_catalogs.json` (`seedTenantTemplateCatalogs`).

## Frontend

- `entities/tenant` (tipos + `tenantApi`).
- `features/tenant/tenant-switcher`: en la barra superior. Usuario de cliente: nombre de su empresa. Plataforma con `tenants.view`: selector de cliente; la elección se guarda en `localStorage` (`tm_selected_tenant_v1`), viaja como `X-Tenant-Id` (interceptor en `shared/api/client.ts`) y recarga la app al cambiar. Un `X-Tenant-Id` rechazado borra la elección.
- Login: el slug sale del subdominio (`shared/api/tenant.ts`, `tenantSlugFromHost`): `acme.localhost:5006` en local, `acme.<VITE_TENANT_BASE_DOMAIN>` en producción; `app.`/`admin.`/`www.` o sin subdominio = plataforma.
- Consola de plataforma en `/` (sin cliente elegido): `pages/home/PlatformHomePage` + `features/tenant/tenants-console` (tabla con uso/límite de personas y relojes, alta guiada con selector de plan, entrar, suspender/reactivar y diálogo **Plan** del cliente). "Entrar" llama primero a `POST /tenants/:id/impersonate` (auditoría) y solo entonces guarda la elección (`setSelectedTenant`) y recarga con `X-Tenant-Id`.
- `useClientContext` (`features/tenant/tenant-switcher`): `isPlatform`, `client` y `platformWithoutClient`. Sin cliente elegido solo se abren `PLATFORM_PATHS` (`/`, `/notifications`, `/roles`, `/plans`).

## Notas multi-tenant

- El servicio corre todo en `runWithTenant(null, …, true)`: la tabla `tenants` y los conteos son de plataforma aunque ADMIN venga con `X-Tenant-Id`.
- CORS: `WEB_ORIGIN` acepta lista separada por comas y comodín de subdominio (`http://*.localhost:5006`, `https://*.timemanager.mx`) — `api/src/core/config/cors-origin.ts`.
