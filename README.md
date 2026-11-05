# TimeManager

Sistema de RH y registro de checadas (API + web), recortado del sistema completo de Puerto Nuevo.
Base de datos: PostgreSQL en la nube (Railway/Render), vía `DATABASE_URL`.

Alcance y requisitos de la NOM-037 / registro de jornada: [`docs/RH_MODULO_STANDALONE.md`](docs/RH_MODULO_STANDALONE.md).

Documentación completa en [`docs/`](docs/README.md):

- [`docs/RH_MODULO_STANDALONE.md`](docs/RH_MODULO_STANDALONE.md) — alcance del producto y requisitos NOM.
- [`docs/SAAS_PLAN.md`](docs/SAAS_PLAN.md) — plan de escalamiento a SaaS multi-cliente (decisiones, impacto por módulo, roadmap).
- [`docs/modules/`](docs/modules/README.md) — ficha por módulo: qué hace, endpoints, modelos, permisos y notas multi-tenant.

## Estructura

- `api/`: Express + Prisma (PostgreSQL). Módulos: auth, users, departments, audit, notifications, hr,
  time-clock, access, schedules, overtime, permissions, email, config, dashboard (solo endpoints de RH).
- `web/`: React + Vite. Pantallas de Personal, Usuarios, Departamentos, Checadas, Asistencias,
  Horarios, Tiempo extra, Roles y Notificaciones.

## Puesta en marcha

1. Base de datos: crear una PostgreSQL en el proveedor y copiar la URL de conexión.
2. `api/.env` (no se versiona; ver `api/.env.example`):
   - `DATABASE_URL=postgresql://usuario:clave@host:5432/db?sslmode=require`
   - `JWT_SECRET=...` (cadena aleatoria larga)
   - `ABLY_API_KEY=...` (o un valor de prueba si no usas tiempo real)
3. Migrar y crear el administrador inicial:

   ```bash
   cd api
   pnpm install
   npx prisma migrate deploy
   INITIAL_ADMIN_USERNAME=admin INITIAL_ADMIN_PASSWORD='cambia-esta-clave' pnpm exec ts-node -r tsconfig-paths/register prisma/seed.ts
   pnpm dev
   ```

4. Web:

   ```bash
   cd web
   pnpm install
   pnpm dev   # http://localhost:5006 (usa VITE_API_URL, por defecto http://localhost:4001/api/v1)
   ```

## Estado de verificación

- `api`: `tsc --noEmit` sin errores. Migración baseline (36 tablas) aplicada sobre una PostgreSQL
  descartable local. Seed de admin, arranque de la API, `/health/ready` y login verificados.
- `web`: `tsc -b` sin errores y `vite build` de producción correcto. Login y pantalla de Personal verificados
  contra la API local.
- Pendiente: desplegar la migración en la PostgreSQL de la nube (ver puesta en marcha).
