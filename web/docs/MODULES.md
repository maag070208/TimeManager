# Puerto Nuevo — Web (Cartas Responsivas)

Mapa de módulos y funcionalidades del frontend web.

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19 |
| Build | Vite 6 + TypeScript 5.7 |
| Estado | Redux Toolkit 2 (`react-redux`) |
| Rutas | React Router 7 |
| Design system | `@axzydev/axzy_ui_system` 1.3.0 |
| i18n | i18next + react-i18next (es + en) |
| Realtime | Ably 2.27 |
| PDF | `@react-pdf/renderer` 4 |
| Validación | yup |
| HTTP | axios (`shared/api/client`) |
| Tests E2E | Playwright |

## Arquitectura

Feature-Sliced Design (FSD):

```
src/
  app/        # bootstrap, store, router (App.tsx), guards
  entities/   # API + modelos + slices por dominio
  features/   # casos de uso (model/use*.ts + ui/)
  widgets/    # composición compleja (PDFs, paneles, kanban)
  pages/      # rutas
  shared/     # api, ui, lib, i18n, pdf, utils, validation
```

- Entidades: `user`, `department`, `subarea`, `personal`, `inventory`, `endTime`, `report`, `ticket`, `notification`, `dashboard`, `audit-log`, `sys-config`.
- Estado global Redux: `auth`, `notifications`, `tickets` (+ slices por entidad).

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
| `ADMIN` | Equipo TimeManager (super admin) | Todos los permisos, incluidos `roles.manage` y `system.configure` |
| `SUPPORT` | Equipo TimeManager (soporte) | Usuarios (ver/editar), relojes, horarios, asistencia, auditoría y planes (ver); sin expedientes ni nómina |
| `CLIENT_ADMIN` | Administrador del cliente | Todo lo operativo de su empresa; sin `roles.manage` ni `system.configure` |
| `HUMAN_RESOURCES` | RH del cliente | Expedientes, altas de personal, checadas, horarios, horas extra, nómina y reportes |
| `CLIENT_STAFF` | Personal del cliente | Solo su propia asistencia (`attendance.view: OWN`) |

Los roles viven en BD (tabla `roles`) y la UI se gobierna por permisos (`useCan`, `RequiresPermission`); la matriz base está en `api/prisma/seed-data/role_permissions.json`.

## Módulos

El producto es solo el servicio de checadas. Tickets, inventario, cocina y las pantallas del guardia (bitácora y entradas/salidas) se quitaron de la web; el guardia opera desde su app móvil contra el módulo `access` del API.

### 1. Auth
- Rutas: `/login`
- `pages/auth/LoginPage`, `features/auth/login`
- Login usuario/password, token + sesión (`shared/api/session`), `me`, logout. Guard `PrivateRoutes` redirige sin token.

### 2. Inicio / Dashboard
- Rutas: `/`
- `pages/home/HomePage`, `features/home/admin-dashboard`
- Home vacío para empleados. Dashboard admin (ADMIN+MANAGER): resumen, stats, donut chart, feed de actividad reciente.

### 3. Recursos Humanos / Empleados (`hr.records`)
- Rutas: `/employees`, `/employees/:id`, `/employees/:id/edit`, `/employees/disciplinary-reports`, `/employees/disciplinary-reports/:id`, `/employees/catalogs/documents`
- Lista de empleados, detalle, edición de perfil (foto, datos).
- Documentos por empleado + catálogo de tipos de documento.
- Actas administrativas: crear, ver detalle, borrar, PDF.
- Reportes de personal.
- Endpoints: `/hr/stats`, `/hr/:id`, `/hr/:id/profile`, `/hr/:id/photo`, `/hr/:id/documents`, `/hr/catalogs/*`, `/hr/disciplinary-reports/*`.

### 4. Departamentos
- Rutas: `/departments`, `/departments/:id`
- `pages/departments`, `features/department`
- CRUD, soft-delete, detalle con info + aside.
- Endpoints: `/departments`.

### 5. Subáreas
- Rutas: `/subareas`
- `pages/subareas`, `features/subarea`
- CRUD, soft-delete.
- Endpoints: `/subareas`.

### 6. Usuarios → fundido en Personal
- Ya no hay pantalla de Usuarios: cuentas y expedientes viven en `/employees` (ver `docs/modules/users.md`). Rutas: `/employees/new`, `/employees/import`, `/employees/:id/account`, `/employees/:id/history`; las `/users/*` redirigen.
- Lista, crear/editar, cambio password, activar/desactivar, historial (timeline + audit-log), importación (panel + resultado).
- Endpoints: `/users`, `/users/:id/password`, `/users/:id/deactivate`, `/users/:id/reactivate`, `/users/employees`, `/auth/login`, `/auth/me`.

### 7. Catálogos (solo ADMIN)
- Rutas: `/catalogs`
- `pages/catalog/CatalogPage`, `widgets/catalog/tabs`
- Tabs:
  - Departamentos
  - Subáreas
  - Tipos de dispositivo (serie/MAC/IP/equipo/folio)
  - Tipos de documento
  - Géneros
  - Tipos de sangre
  - Notificaciones (sys-config)

### 8. Notificaciones (todos)
- Rutas: `/notifications`
- `pages/notifications`, `features/notification/list`
- Lista, no leídas, marcar leída/todas, borrar. Realtime vía Ably (`useAblyNotifications`) + toast.
- Endpoints: `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all`.

### 9. Plataforma: clientes y planes
- Rutas: `/` (consola de clientes, sin cliente elegido) y `/plans`
- `pages/home/PlatformHomePage` + `features/tenant/tenants-console`: tabla con personas y relojes contra su límite, alta guiada con selector de plan, **Entrar**, suspender/reactivar y diálogo **Plan** del cliente (`PlanAssignDialog`).
- `pages/plans/PlansPage` + `features/plan/plans-console`: catálogo de planes (`plans.view`) con alta/edición (`PlanFormDialog`) y baja/reactivación; solo `plans.manage` ve las acciones.
- `entities/plan` (`planApi`) y `entities/tenant` (`tenantApi`).
- Endpoints: `/plans` (solo plataforma), `/tenants`, `/tenants/:id`.

## Widgets PDF / render (`widgets/`)

| Widget | Función |
|--------|---------|
| `carta-responsiva` | Preview HTML + PDF de carta responsiva |
| `acta-administrativa` | Preview + PDF de acta administrativa |
| `credencial-empleado` | Render PNG/QR (`buildQrPayload`, DPI, cardSpec) |
| `movimiento-pdf` | PDF de movimientos + reporte |
| `reports` | PDFs: Asignados, Device, Report, Salidas |
| `tickets` | ticket-pdf, attachments, detail modal, kanban-ui |
| `catalog` | Paneles de departamentos/subáreas + tabs |

## Entidades (capa API/modelo)

`user`, `department`, `subarea`, `personal`, `inventory`, `endTime`, `report`, `ticket`, `notification`, `dashboard`, `audit-log`, `sys-config`.

Cada entidad: `api/*.ts` (cliente axios), `model/types.ts`, `index.ts` (barrel). Slices Redux en `model/*.slice.ts` para auth, notifications, tickets.

## Convenciones

- Feature: `features/<dominio>/<caso-uso>/{model}/use*.ts, ui/*.tsx, index.ts}`.
- Página: `pages/<dominio>/*Page.tsx` que compone feature(s).
- Imports por alias: `@app`, `@entities`, `@features`, `@pages`, `@widgets`, `@shared`.
- i18n namespaces por dominio en `shared/i18n/locales/{es,en}/`.
- Sin comentarios en código salvo casos no obvios.
