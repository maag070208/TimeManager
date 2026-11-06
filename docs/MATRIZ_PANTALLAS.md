# Matriz de pantallas y plan de refinamiento UI

Fecha: 2026-11-05. Objetivo: **una sola familia visual** (patrón bento TimeManager) en todas las pantallas.

## Regla de diseño (bento TimeManager)

1. **Ancho completo** (`ITPage` con `min-w-full! max-w-none!`), nunca formularios apilados en columna angosta.
2. **Grid de 12 columnas** (`lg:grid-cols-12`): contenido 7–8, panel lateral 4–5 sticky.
3. **Hero de contexto** (fondo `#0f2e3d`) con 3–5 KPIs y estado (configurado/pendiente/activo).
4. **Tarjetas bento** agrupadas por tarea; campos en grid `repeat(auto-fit, minmax(180–240px, 1fr))` (inline, porque Tailwind del tema no siempre genera `sm:grid-cols-*`).
5. **Acciones principales** arriba a la derecha + botón sticky en el panel lateral.
6. **Listas**: tarjetas/filas con badges; filtros como pills arriba; vacío con Tic.
7. **Tablas**: `ITDataTable` dentro de tarjeta, sin romper el ancho.
8. **Colores**: `#0f2e3d` hero, slate 50/100 cards, success/warning/danger solo estado.
9. **Responsive**: una columna en móvil; el panel lateral baja al final.
10. **Sin** modales gigantes para configuración; secciones y panel lateral.
11. **Tooltips**: cada sección/campo complejo lleva icono de ayuda (`HelpTip`, portal para no recortarse) que explica qué hace y su impacto.

## Matriz

| # | Pantalla | Ruta | Acceso | Archivo | Estado UI | Lote |
|---|---|---|---|---|---|---|
| 1 | Landing pública | `/landing` | Público | `pages/landing` | Consistente (marca) | — |
| 2 | Login | `/login` | Público | `pages/auth/LoginPage` | Consistente (marca) | — |
| 3 | Inicio cliente | `/` | Sesión de cliente | `pages/home/ClientHomePage` | Bento (bento strip) | B1 |
| 4 | Inicio plataforma | `/` sin cliente | ADMIN/SUPPORT | `pages/home/PlatformHomePage` | Por auditar | B1 |
| 5 | Mi jornada | `/mi-jornada` | Personal | `pages/nom/MyWorkdayPage` | **Bento ✅** | — |
| 6 | Empleados | `/employees` | `hr.records/users.view` | `pages/employees/EmployeesListPage` | Por refinar | B3 |
| 7 | Alta de empleado | `/employees/new` | `users.create` | `pages/users/UserFormPage` | Por refinar | B3 |
| 8 | Importar empleados | `/employees/import` | `users.create` | `pages/users/UserImportPage` | Por refinar | B3 |
| 9 | Editar empleado | `/employees/:id/edit` | `users.edit` | `pages/users/UserFormPage` | Por refinar | B3 |
| 10 | Cuenta de acceso | `/employees/:id/account` | `users.edit` | `pages/users` | Por refinar | B3 |
| 11 | Perfil/expediente | `/employees/:id` | `hr.records` | `pages/employees/EmployeeDetailPage` | Por refinar | B3 |
| 12 | Historial del empleado | `/employees/:id/history` | `hr.records` | `pages/users/UserHistoryPage` | Por refinar | B3 |
| 13 | Expedientes y documentos | `/employees/records` | `hr.records` | `pages/employees/EmployeeRecordsPage` | Por refinar | B3 |
| 14 | Catálogo de documentos | `/employees/catalogs/documents` | `hr.records` | `pages/employees/DocumentCatalogPage` | Por refinar | B3 |
| 15 | Reportes de RH | `/employees/disciplinary-reports` | `hr.records` | `pages/employees/HrReportsPage` | Por refinar | B3 |
| 16 | Detalle de reporte | `/employees/disciplinary-reports/:id` | `hr.records` | `pages/employees/DisciplinaryReportDetailPage` | Por refinar | B3 |
| 17 | Departamentos | `/departments` | `departments.view` | `pages/departments/DepartmentsPage` | Por refinar | B1 |
| 18 | Detalle departamento | `/departments/:id` | `departments.view` | `pages/departments/DepartmentDetailPage` | Por refinar | B1 |
| 19 | Subáreas | `/subareas` | `subareas.view` | `pages/subareas/SubareasPage` | Por refinar | B1 |
| 20 | Relojes (configuración) | `/time-clocks` | `time_clocks.manage` | `pages/access/TimeClocksPage` | Por refinar | B2 |
| 21 | Dashboard del reloj | `/time-clocks/dashboard` | `time_clocks.manage` | `pages/access/TimeClockDashboardPage` | Por refinar | B2 |
| 22 | Personas del reloj | `/time-clocks/people` | `time_clocks.manage` | `pages/access/TimeClockPeoplePage` | Por refinar | B2 |
| 23 | Inspeccionar reloj | `/time-clocks/inspect` | `time_clocks.manage` | `pages/access/TimeClockInspectPage` | Por refinar | B2 |
| 24 | Asistencia (reporte) | `/hr/time-clock` | `time_clock.view` | `pages/access/TimeClockPage` | Por refinar | B2 |
| 25 | Entradas y salidas | `/hr/time-clock/entries-exits` | `time_clock.view` | `pages/access/TimeClockReportPage` | Por refinar | B2 |
| 26 | Roster | `/hr/time-clock/roster` | `time_clock.view` | `pages/access/TimeClockRosterPage` | Por refinar | B2 |
| 27 | Empleados del reloj | `/hr/time-clock/employees` | `time_clock.view` | `pages/access/TimeClockEmployeesPage` | Por refinar | B2 |
| 28 | Diferencias de reloj | `/hr/time-clock/employees/differences` | `time_clock.view` | `pages/access/TimeClockDifferencesPage` | Por refinar | B2 |
| 29 | Horarios | `/schedules` | `schedules.view` | `pages/schedules/SchedulesPage` | Por refinar | B4 |
| 30 | Alta/edición de horario | `/schedules/new`, `/schedules/:id/edit` | `schedules.edit` | `pages/schedules/ScheduleFormPage` | Por refinar | B4 |
| 31 | Asignar horarios | `/schedules/assign` | `schedules.view` | `pages/schedules/AssignSchedulesPage` | Por refinar | B4 |
| 32 | Tiempo extra | `/schedules/overtime/approval` | `overtime.view` | `pages/overtime/OvertimeApprovalPage` | Por refinar | B4 |
| 33 | Pre-nómina | `/schedules/payroll` | `payroll.view` | `pages/schedules/PayrollPage` | **Referencia ✅** | — |
| 34 | Historial de pre-nómina | `/schedules/payroll/history` | `payroll.view` | `pages/schedules/PayrollHistoryPage` | Por refinar | B4 |
| 35 | Nómina configurable | `/payroll/settings` | `payroll.close` | `pages/payroll/PayrollSettingsPage` | **Bento ✅** | — |
| 36 | Convenios y acuerdos | `/hr/jornada-acuerdos` | `time_clock.write` | `pages/nom/WorkdayAgreementsPage` | **Bento ✅** | — |
| 37 | Vacaciones y permisos | `/hr/leave` | `time_clock.write` | `pages/leave/LeaveAdminPage` | **Bento ✅** | — |
| 38 | Teletrabajo | `/teletrabajo` | `time_clock.view` | `pages/nom/TeleworkAdminPage` | **Bento ✅** | — |
| 39 | Configuración del cliente | `/settings/general` | `time_clock.write` | `pages/settings/GeneralSettingsPage` | **Bento ✅** | — |
| 40 | Roles y permisos | `/roles` | `roles.manage` | `pages/roles/RolesPage` | Por refinar | B1 |
| 41 | Planes | `/plans` | `plans.view` | `pages/plans/PlansPage` | Por refinar | B1 |
| 42 | Notificaciones | `/notifications` | Sesión | `pages/notifications/NotificationsPage` | Por refinar | B1 |

## Auditoría de ancho (2026-11-05)

Se revisaron las 39 páginas con `ITPage`: **ninguna queda en columna angosta**; todas usan
`min-w-full`/`noPadding` o `maxWidth="7xl"`. Las pantallas de empleados, horarios, checadas y
relojes ya usan los componentes bento del sistema (`ITBentoStatStrip`, `ITBentoGrid`,
`PanelCard`, `FilterPills`). El refinamiento restante es detalle por pantalla, no reescritura.

## Lotes de refinamiento

| Lote | Pantallas | Entregable |
|---|---|---|
| **B1 Administración** | Inicio plataforma, departamentos, subáreas, roles, planes, notificaciones | Bento + hero + panel lateral; listas y formularios compactos |
| **B2 Asistencia/relojes** | 8 pantallas de `/hr/time-clock` y `/time-clocks` | Bento operativo: KPIs de hoy, salud del reloj, tabla ancha, panel de acciones |
| **B3 Empleados/RH** | 11 pantallas de empleados, expediente, documentos, reportes | Ficha con hero, tabs, panel de resumen; tablas y formularios bento |
| **B4 Horarios/nómina** | horarios, asignación, tiempo extra, historial de pre-nómina | Bento de planeación y aprobación; consistente con pre-nómina |
| **B5 Cumplimiento** | vacaciones, teletrabajo | Bento de políticas, saldos y checklist |

## Criterio de terminado por pantalla

- Ancho completo y grid bento (no formularios apilados).
- Hero/contexto con KPIs o estado.
- Panel lateral sticky con resumen/acciones.
- Estados de carga, vacío y error con Tic/ContentSkeleton.
- Responsive móvil sin desbordes.
- `tsc` y lint en verde; E2E de la pantalla si existe.
