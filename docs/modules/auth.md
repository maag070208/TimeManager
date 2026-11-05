# auth — Autenticación y sesión

Login por usuario/contraseña con JWT, refresh de token, sesión actual y cambio de contraseña. Soporta contraseña provisional (`mustChangePassword`) que obliga a cambiarla al primer ingreso.

## Endpoints

`POST /login`, `POST /refresh`, `GET /me` (sesión), `POST /change-password`.

## Modelos

`User` (credenciales, rol base), `Role`.

## Frontend

`pages/auth/LoginPage`, `features/auth/login`, sesión en `shared/api/session`, guardia global en `app/guards/PrivateRoutes.tsx`.

## Notas multi-tenant

- **Cuello de botella #1 del SaaS**: `username` y `email` son `@unique` globales. Hay que decidir identidad por tenant (login con cliente+usuario) o identidad global (email único + membresías por tenant). Ver decisión D1 en [../SAAS_PLAN.md](../SAAS_PLAN.md).
- El JWT debe cargar `tenantId` (y rol dentro del tenant) para que el middleware de aislamiento funcione sin consultas extra.
- Considerar por cliente: políticas de contraseña, bloqueo por intentos y, más adelante, SSO (Google/Microsoft) como feature de plan alto.
