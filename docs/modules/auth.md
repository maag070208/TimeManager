# auth — Autenticación y sesión

Login por usuario/contraseña con JWT, refresh de token, sesión actual y cambio de contraseña. Soporta contraseña provisional (`mustChangePassword`) que obliga a cambiarla al primer ingreso.

## Endpoints

`POST /login`, `POST /refresh`, `GET /me` (sesión), `POST /change-password`.

## Modelos

`User` (credenciales, rol base), `Role`.

## Frontend

`pages/auth/LoginPage`, `features/auth/login`, sesión en `shared/api/session`, guardia global en `app/guards/PrivateRoutes.tsx`.

## Notas multi-tenant

- Login por cliente (F1A-04): `POST /login` acepta `tenant` (slug). Con slug busca `(tenantId, username)`; sin slug solo usuarios de plataforma. Cliente suspendido → 403 `TENANT_SUSPENDED`.
- JWT y refresh llevan `tenantId`; `/me` devuelve `tenant { id, slug, name, timezone }` (`null` = plataforma).
- `X-Tenant-Id` solo para ADMIN/SUPPORT de plataforma (validado contra `tenants`).
- Web (F1A-07): el slug sale del subdominio (`shared/api/tenant.ts`); el login muestra "Empresa: <slug>" o "Acceso del equipo de TimeManager".
- Pendiente: la app de escritorio (Electron) no tiene subdominio, así que hoy solo permite login de plataforma.
- Considerar por cliente: políticas de contraseña, bloqueo por intentos y, más adelante, SSO (Google/Microsoft) como feature de plan alto.
