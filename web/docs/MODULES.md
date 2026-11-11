# CheckLab — Web (mapa de módulos)

Mapa de módulos y funcionalidades del frontend web (`web/`). El producto es el
servicio de checadas (registro electrónico de jornada + RH de soporte); las
pantallas de tickets, inventario, cocina y guardia del ERP origen ya no existen.

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19 |
| Build | Vite 6 + TypeScript 5.7 |
| Estado | Redux Toolkit 2 (`react-redux`) |
| Rutas | React Router 7 (`HashRouter`) |
| Design system | `@axzydev/axzy_ui_system` 1.8.14 |
| i18n | i18next + react-i18next (es + en) |
| Realtime | Ably 2.27 (token por usuario) |
| PDF | `@react-pdf/renderer` 4 |
| HTTP | axios (`shared/api/client`) |
| Escritorio | Electron (`pnpm desktop`) |
| Tests E2E | Playwright |

## Arquitectura

Feature-Sliced Design (FSD):

```
src/
  app/        # bootstrap, HashRouter, store, guards
  entities/   # API + modelos + slices por dominio
  features/   # casos de uso (model/use*.ts + ui/)
  widgets/    # composición compleja (PDFs, credencial)
  pages/      # rutas
  shared/     # api, ui, lib, i18n, pdf, utils
```

- Estado global Redux: `auth`, `notifications`, `toast`.
- Cada entidad: `api/*.ts` (cliente axios), `model/types.ts` (+ slice si aplica), `index.ts` (barrel).

## Multi-cliente: ruta por cliente y subdominio

Cada cliente se resuelve de la URL (`shared/lib/tenant-route`, `shared/api/tenant`):

- **Ruta por cliente (local-first)**: `http://localhost:5006/#/cliente1/home`,
  `/#/cliente2/home`. El primer segmento del hash es el slug y `HashRouter`
  arranca con `basename="/<slug>"`; la URL canónica de inicio es
  `/#/<slug>/home` y el login `/#/<slug>/login`. Un slug desconocido cae en su
  login (`/#/noexiste/login`).
- **Subdominio (legado y producción)**: `acme.localhost:5006` /
  `acme.<VITE_TENANT_BASE_DOMAIN>`. El slug sale del host y la URL sigue **sin
  prefijo** (`/#/login`, `/#/`, `/#/hr/time-clock`): los enlaces y sesiones
  existentes no cambian.
- La plataforma (ADMIN/SUPPORT) vive siempre sin prefijo (`/#/login`, `/#/`).
  `TenantRouteGate` corrige una URL que no coincide con la sesión: personal de
  plataforma bajo el prefijo de un cliente, o un cliente bajo la ruta de otro.
- Los primeros segmentos que ya son rutas de la app (`login`, `home`,
  `mi-jornada`, `teletrabajo`, `users`, `employees`, `departments`, `subareas`,
  `roles`, `plans`, `notifications`, `hr`, `time-clocks`, `schedules`) nunca se
  leen como slug y quedan reservados al dar de alta clientes.
- `/users/*` conserva el prefijo del cliente (`/#/acme/users` →
  `/#/acme/employees`).

## Roles y permisos

| Rol | Quién | Alcance |
|-----|-------|---------|
| `ADMIN` | Equipo CheckLab (super admin) | Todos los permisos, incluidos `roles.manage` y `system.configure` |
| `SUPPORT` | Equipo CheckLab (soporte) | Usuarios (ver/editar), relojes, horarios, asistencia, auditoría y planes (ver); sin expedientes ni nómina |
| `CLIENT_ADMIN` | Administrador del cliente | Todo lo operativo de su empresa; sin `roles.manage` ni `system.configure` |
| `HUMAN_RESOURCES` | RH del cliente | Expedientes, altas de personal, checadas, horarios, horas extra, nómina y reportes |
| `CLIENT_STAFF` | Personal del cliente | Solo su propia asistencia (`attendance.view: OWN`) y su jornada/teletrabajo |

Los roles viven en BD (tabla `roles`) y la UI se gobierna por permisos (`useCan`,
`RequiresPermission`); la matriz base está en
`api/prisma/seed-data/role_permissions.json`.

## Módulos

### 1. Auth
- Rutas: `/login`
- `pages/auth/LoginPage`, `features/auth/login`
- Login usuario/password por cliente (slug en la URL), token + sesión
  (`shared/api/session`), `me`, refresh y logout. `PrivateRoutes` redirige sin
  token y fuerza el cambio de contraseña provisional.

### 2. Inicio
- Rutas: `/` (entrada), `/home` (inicio explícito)
- `pages/home/HomePage` + `features/tenant/tenant-switcher` (`useClientContext`)
- Sin cliente elegido (ADMIN/SUPPORT) = consola de plataforma: clientes, estado,
  personas y relojes contra su límite, plan y alta guiada
  (`pages/home/PlatformHomePage`, `features/tenant/tenants-console`). Editar,
  entrar, relojes, agente y suspender/reactivar viven en el detalle `/tenants/:id`.
- Con cliente (o sesión de cliente) = inicio del cliente
  (`features/home/client-overview`): tableros de personal, expedientes,
  asistencia de hoy, tiempo extra y huecos de configuración.

### 3. Mi jornada y teletrabajo (autoservicio)
- Rutas: `/mi-jornada`, `/teletrabajo`
- `pages/nom/*`, `features/nom`
- El trabajador consulta sus marcajes y jornada, reporta discrepancias y registra
  su teletrabajo (NOM/LFT 2027). Endpoints: `/nom/*`.

### 4. Personal (cuentas + expedientes)
- Rutas: `/employees`, `/employees/:id`, `/employees/:id/account`,
  `/employees/:id/edit`, `/employees/records`, `/employees/catalogs/documents`,
  `/employees/disciplinary-reports`, `/employees/disciplinary-reports/:id`,
  `/employees/:id/history`, `/employees/new`, `/employees/import`
- `pages/employees/*`, `features/user/*`, `features/hr/*`
- Lista (con `hr.records` sale del expediente; si no, de las cuentas), alta,
  edición de perfil (foto, datos, documentos), baja/reactivación, historial,
  importación Excel, actas administrativas y catálogo de tipos de documento.
- Pestaña **Actividad** de la ficha: `GET /hr/:id/overview` (`hr.records`) con
  documentos cargados/faltantes, checadas de los últimos 30 días, actas del año
  y horario vigente. Ya no depende de tickets, tareas ni inventario.
- `/users/*` redirige a su equivalente en `/employees/*`.

### 5. Departamentos y subáreas
- Rutas: `/departments`, `/departments/:id`, `/subareas`
- `pages/departments`, `pages/subareas`, `features/department`, `features/subarea`
- CRUD con baja lógica; el detalle del departamento muestra su plantilla.
- Endpoints: `/departments`, `/subareas`.

### 6. Roles y permisos
- Ruta: `/roles` (guard `roles.manage`)
- `pages/roles/RolesPage`, `features/roles/roles-console`
- Matriz rol → permiso → alcance, catálogo de permisos, políticas ABAC, acceso
  efectivo por persona, probador y bitácora de cambios. Endpoints: `/permissions/*`.
- Con cliente activo no se ofrecen roles de plataforma (ADMIN/SUPPORT).

### 7. Planes y clientes (plataforma)
- Rutas: `/plans` (guard `plans.view`) y consola de clientes en `/`
- `pages/plans/PlansPage`, `features/plan/plans-console`, `entities/plan`
- Catálogo de planes (`plans.manage`): nombre, personas, relojes y precio de
  lista; baja/reactivación. La ficha del cliente (`PlanAssignDialog`) muestra
  uso/límite y asigna plan. Endpoints: `/plans`, `/tenants`.

### 8. Notificaciones
- Ruta: `/notifications`
- `pages/notifications`, `features/notification`, `entities/notification`
- Bandeja, no leídas, marcar leída/todas, borrar y avisos en vivo por Ably
  (`useAblyNotifications`). Endpoints: `/notifications/*`, `/notifications/ably-token`.

### 9. Reloj checador (Hikvision)
- Rutas: `/hr/time-clock`, `/hr/time-clock/entries-exits`,
  `/hr/time-clock/roster`, `/hr/time-clock/employees`,
  `/hr/time-clock/employees/differences`
- Rutas de configuración: `/time-clocks`, `/time-clocks/dashboard`,
  `/time-clocks/people`, `/time-clocks/inspect`
- `pages/access/*`, `features/access/*`, `widgets/time-clock-dashboard`,
  `widgets/employee-clock`
- Checadas del reloj, reporte de entradas/salidas, roster, vínculo de números
  del reloj con personas, diferencias y administración de relojes (URL, estado,
  credenciales write-only). Endpoints: `/time-clock/*`.

### 10. Horarios, tiempo extra y pre nómina
- Rutas: `/schedules`, `/schedules/new`, `/schedules/:id/edit`,
  `/schedules/assign`, `/schedules/overtime/approval`, `/schedules/payroll`
- `pages/schedules/*`, `pages/overtime/*`, `features/schedule/*`
- Horarios y asignación masiva, aprobación de tiempo extra y pre nómina semanal.
  Endpoints: `/schedules/*`, `/overtime/*`.

## Widgets (`widgets/`)

| Widget | Función |
|--------|---------|
| `disciplinary-report` | Preview HTML + PDF del acta administrativa |
| `employee-credential` | Credencial PNG/QR del empleado (`buildQrPayload`, DPI, cardSpec) |
| `employee-clock` | Tarjeta/chip del vínculo del empleado con el reloj |
| `reports` | PDFs de reportes de asistencia |
| `time-clock-dashboard` | Tarjetas y estado del reloj en el dashboard |

## Entidades (capa API/modelo)

`access`, `agent`, `audit-log`, `dashboard`, `department`, `hr`, `nom`,
`notification`, `overtime`, `permission`, `plan`, `report`, `schedule`,
`subarea`, `sys-config`, `tenant`, `time-clock`, `user`.

## Convenciones

- Feature: `features/<dominio>/<caso-uso>/{model}/use*.ts, ui/*.tsx, index.ts`.
- Página: `pages/<dominio>/*Page.tsx` que compone feature(s).
- Imports por alias: `@app`, `@entities`, `@features`, `@pages`, `@widgets`, `@shared`.
- i18n namespaces por dominio en `shared/i18n/locales/{es,en}/`.
- Carga: `ITPage loading` para página completa, `ContentSkeleton` para bloques.
- Sin comentarios en código salvo casos no obvios.

## Landing pública (`/#/landing`)

Página de marketing pública (sin sesión) con diseño **bento**, tema claro/oscuro
(toggle persistido en `localStorage:tm-landing-theme`) y capturas reales del
producto en `public/landing/*.jpg`.

- Archivos: `src/pages/landing/LandingPage.tsx` + `landing.css`; ruta pública en
  `app/App.tsx` (`/landing`, reservada en `APP_ROOT_PATHS` para que el slug del
  cliente no la capture). Enlace “Conoce CheckLab” desde el login.
- Secciones: hero, bento de producto (asistencia, personal, horarios, portal
  móvil, reloj + agente, multi-cliente, cumplimiento), galería, agente,
  planes 500/750/1000, FAQ y CTA.
- Capturas: se generan con Playwright contra el stack E2E (`api/scripts/e2e-seed.ts`),
  se anonimiza la barra superior (cliente/usuario) y la consola de clientes se
  sustituye por una ilustración con clientes ficticios: la landing es pública y
  no debe revelar qué clientes existen
  iniciando sesión como `acme.admin` / `acme.staff` / `e2e.admin` y guardando en
  `public/landing/`. Para regenerarlas, repetir la captura con el runner
  `node scripts/e2e-run.mjs <spec-de-captura> --project=chromium`.
- E2E: `tests/e2e/landing.spec.ts` (tema, FAQ, planes, login) y
  `tests/e2e/landing.mobile.spec.ts` (sin desbordes en móvil).
- Animación: revelado por scroll con `IntersectionObserver` (`[data-reveal]`),
  tarjetas flotantes en el hero, hover de tarjetas/capturas y aurora sutil;
  todo se desactiva con `prefers-reduced-motion`. Las capturas se recortan en
  móvil (`lp-shot`) para que se lean y la página no desborde (`overflow-x: clip`).
