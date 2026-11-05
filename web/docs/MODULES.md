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

## Roles y permisos

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso total |
| `MANAGER` | Admin dashboard, tickets/admin tareas, inventario NO |
| `AREA_HEAD` | `canManage` (tickets/gestión) sin expediente RRHH completo |
| `HUMAN_RESOURCES` | Expediente completo de personal (`canManageHR`) |
| `EMPLOYEE` | Solo tickets (mis tareas), notificaciones |

Derivados en `app/guards/PrivateRoutes.tsx`:
- `isAdmin = ADMIN || MANAGER`
- `canManage = isAdmin || AREA_HEAD`
- `canManageHR = ADMIN || HUMAN_RESOURCES` (expediente médico/documentos NO para MANAGER)

## Módulos

### 1. Auth
- Rutas: `/login`
- `pages/auth/LoginPage`, `features/auth/login`
- Login usuario/password, token + sesión (`shared/api/session`), `me`, logout. Guard `PrivateRoutes` redirige sin token.

### 2. Inicio / Dashboard
- Rutas: `/`
- `pages/home/HomePage`, `features/home/admin-dashboard`
- Home vacío para empleados. Dashboard admin (ADMIN+MANAGER): resumen, stats, donut chart, feed de actividad reciente con links a ticket/préstamo/dispositivo (`activityLinks.ts`).

### 3. Inventario (solo ADMIN)
- Rutas: `/inventory`, `/inventory/devices`, `/inventory/device-types`, `/inventory/movements`, `/inventory/loans`, `/inventory/returns`
- Dashboard: KPIs de inventario (`/inventory/dashboard`).
- Dispositivos: CRUD, tipos, existencias, unidades físicas (serie/MAC/IP/equipo), kardex, detalle.
- Movimientos: alta, filtros por tipo/dispositivo, revertir.
- Préstamos: crear, editar, cancelar, detalle (cartas responsivas).
- Devoluciones: registrar con condición por ítem.
- Endpoints: `/inventory/device-types`, `/inventory/devices`, `/inventory/units`, `/inventory/movements`, `/inventory/loans`, `/inventory/returns`, `/inventory/dashboard`.

### 4. Tareas / Tickets (todos)
- Rutas: `/tickets`, `/tickets/kanban`, `/tickets/my-tasks`, `/tickets/tasks`, `/tickets/new`, `/tickets/:id`, `/tickets/:id/edit`
- Lista, crear, editar, detalle.
- Kanban board.
- Mis tareas (EMPLOYEE), Admin tareas (ADMIN/MANAGER).
- Detalle: comentarios, asignaciones con comentarios/adjuntos, historial, grafo de tareas, panel manager, PDF.
- Endpoints: `/tickets`, `/tickets/kanban`, `/tickets/:id/attachments`, `/tickets/:id/assignments`, `/tickets/:id/comments`.

### 5. Recursos Humanos / Empleados (ADMIN + HUMAN_RESOURCES)
- Rutas: `/employees`, `/employees/:id`, `/employees/:id/edit`, `/employees/disciplinary-reports`, `/employees/disciplinary-reports/:id`, `/employees/catalogs/documents`
- Lista de empleados, detalle, edición de perfil (foto, datos).
- Documentos por empleado + catálogo de tipos de documento.
- Actas administrativas: crear, ver detalle, borrar, PDF.
- Reportes de personal.
- Endpoints: `/hr/stats`, `/hr/:id`, `/hr/:id/profile`, `/hr/:id/photo`, `/hr/:id/documents`, `/hr/catalogs/*`, `/hr/disciplinary-reports/*`.

### 6. Departamentos
- Rutas: `/departments`, `/departments/:id`
- `pages/departments`, `features/department`
- CRUD, soft-delete, detalle con info + aside.
- Endpoints: `/departments`.

### 7. Subáreas
- Rutas: `/subareas`
- `pages/subareas`, `features/subarea`
- CRUD, soft-delete.
- Endpoints: `/subareas`.

### 8. Reportes (solo ADMIN)
- Rutas: `/reports`
- `pages/reports/ReportesPage`, `features/report/*`
- Tabs: Asignados, Dispositivos, Salidas. Cada uno con export PDF (`widgets/reports`).
- Endpoints: `/reports`, `/reports/assigned-devices`, `/reports/devices`.

### 9. Usuarios (solo ADMIN)
- Rutas: `/users`, `/users/new`, `/users/:id/edit`, `/users/:id/history`, `/users/import`
- Lista, crear/editar, cambio password, activar/desactivar, historial (timeline + audit-log), importación (panel + resultado).
- Endpoints: `/users`, `/users/:id/password`, `/users/:id/deactivate`, `/users/:id/reactivate`, `/users/employees`, `/auth/login`, `/auth/me`.

### 10. Catálogos (solo ADMIN)
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

### 11. Notificaciones (todos)
- Rutas: `/notifications`
- `pages/notifications`, `features/notification/list`
- Lista, no leídas, marcar leída/todas, borrar. Realtime vía Ably (`useAblyNotifications`) + toast.
- Endpoints: `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all`.

### 12. Salidas (sin página propia)
- Entidad `entities/salida` con CRUD completo (`/material-outputs`, `/material-outputs/batch`, `/material-outputs/suggestions`).
- Se consume desde Reportes; no tiene ruta dedicada.

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
