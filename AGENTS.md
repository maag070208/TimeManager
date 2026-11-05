# AGENTS.md — TimeManager

Contexto para agentes que trabajen en este repo. Producto: sistema de RH y registro de checadas (API + web), pensado como módulo independiente con cumplimiento NOM-037 / registro electrónico de jornada (ver `docs/RH_MODULO_STANDALONE.md`).

## Estructura del repo

```
api/   Backend Express + TypeScript + Prisma (PostgreSQL)
web/   Frontend React 19 + Vite 6 + Redux Toolkit + React Router 7 (FSD)
docs/  Documentación del producto (índice en docs/README.md)
```

La documentación vive en `docs/` y se mantiene junto con el código: `docs/modules/<modulo>.md` es la ficha de cada módulo de `api/src/modules/` (alcance, endpoints, modelos, permisos, notas multi-tenant); si un módulo cambia, su ficha se actualiza en el mismo cambio. `docs/SAAS_PLAN.md` es el plan de escalamiento a SaaS multi-cliente; decisiones pendientes marcadas **[ABIERTA]**.

Monorepo con **pnpm workspaces**: `package.json` y `pnpm-workspace.yaml` en la raíz, paquetes `api` (`timemanager-api`) y `web` (`timemanager-web`), **un solo `pnpm-lock.yaml`**. `pnpm install` siempre desde la raíz. Scripts raíz: `pnpm dev` (ambos), `pnpm dev:api`, `pnpm dev:web`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm prisma:generate`, `pnpm prisma:migrate`, `pnpm seed`. Los Dockerfiles se construyen desde la raíz: `docker build -f api/Dockerfile .`.

## API (`api/`)

- **Stack**: Express 4, Prisma 5 (`prisma/schema.prisma`, 36 modelos, baseline `20261104000000_baseline_rh`), zod, JWT, Winston, Swagger, Ably, AWS S3, xlsx.
- **Estructura**: `src/core` (config, db, middlewares, permissions, policies, services, utils) y `src/modules/<modulo>/{controllers,routes,services,models,index.ts}`. Router central: `src/modules/api.router.ts`.
- **Alias TS**: `@src/*`, `@core/*`, `@modules/*` (baseUrl `./`; compilar con `tsc && tsc-alias`).
- **Módulos (15)**: `time-clock`, `access`, `hr`, `schedules`, `overtime` (núcleo RH), `auth`, `users`, `departments`, `permissions`, `audit`, `notifications`, `dashboard`, `config`, `email` (soporte) y `tenants` (clientes de la plataforma). Las carpetas vacías `inventory`, `kitchen`, `tickets`, `hotel-store`, `material-outputs`, `reports`, `suppliers` son residuo del ERP — pendiente borrarlas.
- **Ficha de cada módulo**: `docs/modules/<modulo>.md`.
- **Comandos**:
  - Dev: `pnpm dev` (nodemon)
  - Build: `pnpm build` · Lint: `pnpm lint`
  - Prisma: `pnpm prisma:generate`, `pnpm prisma:migrate` (deploy), `pnpm seed`
  - Tests unitarios: `pnpm test:unit` (node:test + ts-node, `src/**/*.test.ts`, sin BD)
  - Aislamiento entre clientes: `TENANCY_CHECK_DATABASE_URL=<BD de prueba> pnpm tenancy-check` (nunca contra la nube)

### Reglas de base de datos

- PostgreSQL en la nube; `DATABASE_URL` en `api/.env` (no commitear).
- **No usar `DATABASE_URL` como shadow DB**; migraciones SQL a mano con backfill cuando haga falta.
- `pnpm cutover` hace `migrate deploy` + reseed forzado — destructivo, solo si se pide.

## Web (`web/`)

- **Stack**: React 19, Vite 6, TS 5.7, Redux Toolkit, React Router 7, Tailwind 4, design system `@axzydev/axzy_ui_system`, i18next (es/en), Ably, `@react-pdf/renderer`, yup, axios. También app de escritorio con Electron (`pnpm desktop`).
- **Arquitectura**: Feature-Sliced Design — `src/app` (bootstrap, router, guards), `entities` (API + modelos + slices), `features` (casos de uso: `model/use*.ts` + `ui/`), `widgets` (composición, PDFs), `pages` (rutas), `shared` (api, ui, lib, i18n).
- **Alias**: `@app`, `@entities`, `@features`, `@pages`, `@widgets`, `@shared`.
- **Roles** (claves en inglés, nombres en español): `ADMIN` y `SUPPORT` (equipo TimeManager), `CLIENT_ADMIN`, `HUMAN_RESOURCES` y `CLIENT_STAFF` (cliente). Viven en la tabla `roles`; catálogo y matriz en `api/prisma/seed-data/{roles,role_permissions}.json`. La UI se gobierna por permisos (`useCan`), no por clave de rol.
- **Mascota**: Tic (canvas 8-bit, sin imágenes) en `shared/ui/tic` (`Tic`, `TicState`, `TicAvatar`, `Escena`), `shared/ui/tic-chat` y `shared/ui/tic-confirm`; textos en el namespace i18n `tic`.
- **Carga**: un solo indicador, el esqueleto de `ITPage`. Página completa → `<ITPage loading>`; bloque dentro de una página o diálogo → `ContentSkeleton` (`shared/ui/content-skeleton`). No usar spinners, Lottie ni `TicState` para cargar.
- **Inicio (`/`)**: consola de plataforma para ADMIN/SUPPORT sin cliente elegido; inicio del cliente (`features/home/client-overview`) en cualquier otro caso.
- **Multi-cliente**: el login toma el cliente del subdominio (`acme.localhost:5006` en local); ADMIN/SUPPORT eligen cliente en la barra superior (`X-Tenant-Id`).
- **Mapa detallado de módulos frontend**: `web/docs/MODULES.md`.
- **Comandos**:
  - Dev: `pnpm dev` (puerto 5006, strictPort)
  - Build: `pnpm build` (dev mode) / `pnpm build:prod` · Lint: `pnpm lint`

## Reglas de trabajo

- **Idioma**: documentación y UI en español (i18n es/en en `shared/i18n/locales/`).
- **QA tras cambios**: `tsc` (build), `lint` y pruebas unitarias del módulo tocado.
- **No correr E2E salvo que el usuario lo pida explícitamente.**
- Sin comentarios en código salvo casos no obvios (convención del repo).
- Correos: plantillas en `api/src/core/services/email-templates.ts`, siempre por la cola (`enqueueEmail`/`enqueueNotificationEmail`), nunca `sendEmail` desde un request. Detalle en `docs/modules/email.md`.
- Relojes: la URL de cada reloj vive en la BD (alta desde la web); el `.env` solo trae `TIME_CLOCK_USER/PASS` y la estación de huellas. `CHECADOR_URL` ya no se usa.
- Sensibilidad de datos: marcajes, geolocalización y biometría son datos personales sensibles — cifrado, acceso por rol, consentimiento (ver sección 5 de `docs/RH_MODULO_STANDALONE.md`).
- Git: rama `main`, un solo repo (`maag070208/TimeManager`). `api/.github` y `web/.github` son workflows heredados de Puerto Nuevo (publican `axzydev/axzy_ptnv_*`): GitHub no los ejecuta ahí; **no moverlos a la raíz** sin cambiar la imagen destino.

## Pendientes conocidos

- Inmutabilidad de checadas y pista de auditoría de correcciones (principal hueco NOM).
- Bug de retardo: caso Alberto Navarro (DEMO-911) muestra "Retardo 5:59 h" incorrecto — revisar asignación de horario antes de vender el reporte de retardos.
- Requisitos STPS (formato, retención, integridad) aún no publicados — validar con asesor legal antes de vender como "cumple NOM".
