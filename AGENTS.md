# AGENTS.md — TimeManager

Contexto para agentes que trabajen en este repo. Producto: sistema de RH y registro de checadas (API + web), pensado como módulo independiente con cumplimiento NOM-037 / registro electrónico de jornada (ver `docs/RH_MODULO_STANDALONE.md`).

## Estructura del repo

```
api/   Backend Express + TypeScript + Prisma (PostgreSQL)
web/   Frontend React 19 + Vite 6 + Redux Toolkit + React Router 7 (FSD)
docs/  Documentación del producto (índice en docs/README.md)
```

La documentación vive en `docs/` y se mantiene junto con el código: `docs/modules/<modulo>.md` es la ficha de cada módulo de `api/src/modules/` (alcance, endpoints, modelos, permisos, notas multi-tenant); si un módulo cambia, su ficha se actualiza en el mismo cambio. `docs/SAAS_PLAN.md` es el plan de escalamiento a SaaS multi-cliente; decisiones pendientes marcadas **[ABIERTA]**.

No hay package.json raíz: cada carpeta es un proyecto independiente con pnpm.

## API (`api/`)

- **Stack**: Express 4, Prisma 5 (`prisma/schema.prisma`, 36 modelos, baseline `20261104000000_baseline_rh`), zod, JWT, Winston, Swagger, Ably, AWS S3, xlsx.
- **Estructura**: `src/core` (config, db, middlewares, permissions, policies, services, utils) y `src/modules/<modulo>/{controllers,routes,services,models,index.ts}`. Router central: `src/modules/api.router.ts`.
- **Alias TS**: `@src/*`, `@core/*`, `@modules/*` (baseUrl `./`; compilar con `tsc && tsc-alias`).
- **Módulos (14, todos RH)**: `time-clock`, `access`, `hr`, `schedules`, `overtime` (núcleo) y `auth`, `users`, `departments`, `permissions`, `audit`, `notifications`, `dashboard`, `config`, `email` (soporte). Las carpetas vacías `inventory`, `kitchen`, `tickets`, `hotel-store`, `material-outputs`, `reports`, `suppliers` son residuo del ERP — pendiente borrarlas.
- **Ficha de cada módulo**: `docs/modules/<modulo>.md`.
- **Comandos**:
  - Dev: `pnpm dev` (nodemon)
  - Build: `pnpm build` · Lint: `pnpm lint`
  - Prisma: `pnpm prisma:generate`, `pnpm prisma:migrate` (deploy), `pnpm seed`
  - Tests unitarios: `pnpm test:unit` (Playwright con `playwright.unit.config.ts`)

### Reglas de base de datos

- PostgreSQL en la nube; `DATABASE_URL` en `api/.env` (no commitear).
- **No usar `DATABASE_URL` como shadow DB**; migraciones SQL a mano con backfill cuando haga falta.
- `pnpm cutover` hace `migrate deploy` + reseed forzado — destructivo, solo si se pide.

## Web (`web/`)

- **Stack**: React 19, Vite 6, TS 5.7, Redux Toolkit, React Router 7, Tailwind 4, design system `@axzydev/axzy_ui_system`, i18next (es/en), Ably, `@react-pdf/renderer`, yup, axios. También app de escritorio con Electron (`pnpm desktop`).
- **Arquitectura**: Feature-Sliced Design — `src/app` (bootstrap, router, guards), `entities` (API + modelos + slices), `features` (casos de uso: `model/use*.ts` + `ui/`), `widgets` (composición, PDFs), `pages` (rutas), `shared` (api, ui, lib, i18n).
- **Alias**: `@app`, `@entities`, `@features`, `@pages`, `@widgets`, `@shared`.
- **Roles** (claves en inglés, nombres en español): `ADMIN` y `SUPPORT` (equipo TimeManager), `CLIENT_ADMIN`, `HUMAN_RESOURCES` y `CLIENT_STAFF` (cliente). Viven en la tabla `roles`; catálogo y matriz en `api/prisma/seed-data/{roles,role_permissions}.json`. La UI se gobierna por permisos (`useCan`), no por clave de rol.
- **Mapa detallado de módulos frontend**: `web/docs/MODULES.md`.
- **Comandos**:
  - Dev: `pnpm dev` (puerto 5006, strictPort)
  - Build: `pnpm build` (dev mode) / `pnpm build:prod` · Lint: `pnpm lint`

## Reglas de trabajo

- **Idioma**: documentación y UI en español (i18n es/en en `shared/i18n/locales/`).
- **QA tras cambios**: `tsc` (build), `lint` y pruebas unitarias del módulo tocado.
- **No correr E2E salvo que el usuario lo pida explícitamente.**
- Sin comentarios en código salvo casos no obvios (convención del repo).
- Sensibilidad de datos: marcajes, geolocalización y biometría son datos personales sensibles — cifrado, acceso por rol, consentimiento (ver sección 5 de `docs/RH_MODULO_STANDALONE.md`).
- Git: rama `main`, repo nuevo sin commits todavía (al 2026-11-04).

## Pendientes conocidos

- Inmutabilidad de checadas y pista de auditoría de correcciones (principal hueco NOM).
- Bug de retardo: caso Alberto Navarro (DEMO-911) muestra "Retardo 5:59 h" incorrecto — revisar asignación de horario antes de vender el reporte de retardos.
- Requisitos STPS (formato, retención, integridad) aún no publicados — validar con asesor legal antes de vender como "cumple NOM".
