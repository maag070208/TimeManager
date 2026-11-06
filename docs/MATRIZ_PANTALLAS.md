# Matriz y auditoría de pantallas — diseño bento

Fecha de auditoría: **2026-11-06**. Alance: todas las rutas privadas y públicas de la web.

## Cómo se auditó

1. Se enumeraron las rutas reales de `web/src/app/App.tsx` (43 pantallas; las rutas legacy `/users/*` solo redirigen y no cuentan).
2. Se capturó cada pantalla a **1600×1000** con sesión de cliente (`acme.admin`) y de plataforma (`e2e.admin`), y se revisaron en hojas de contacto.
3. Se leyó la composición de cada página y sus componentes de feature: ancho, hero/contexto, KPIs, filtros, tablas, formularios, acciones, tooltips y estados vacíos.
4. Se midió desbordamiento horizontal en el navegador: **0 pantallas con scroll horizontal**.

**Leyenda:** ✅ Cumple · 🟡 Parcial · ❌ No cumple · ➖ No aplica (pantalla pública/marca).

## Regla visual vigente (bento TimeManager)

1. **Ancho completo** (`ITPage` con `min-w-full! max-w-none!` o `noPadding` + `px-8`).
2. **Contexto**: hero pastel de un solo color (sin degradados ni fondos negros) o fila de KPIs blancos con waves.
3. **Filtros**: tarjetas blancas con **wave verde en la activa, sin borde de color** (`BentoFilterCards`). No usar `ITBentoStatStrip` en pantallas nuevas.
4. **Tarjetas**: blancas, borde claro (`#eef1f5`), radios 16–24 px, sombra suave; el color vive en iconos, badges y waves.
5. **Tablas**: `ITDataTable` con paginación; nunca tablas fuera del ancho de la tarjeta.
6. **Formularios**: secciones/campos en grid `repeat(auto-fit, minmax(...))`; resumen lateral; un solo botón de guardar visible por viewport.
7. **Acciones**: compactas; icono si es acción de fila; texto pequeño si es primaria.
8. **Tooltips**: `HelpTip` en campos/secciones cuyo impacto no es obvio.
9. **Estados**: carga con `ContentSkeleton`/`ITPage loading`; vacío/error con Tic.
10. **Responsive**: una columna en móvil; sidebar baja al final.

## Matriz

| # | Pantalla | Ruta | Acceso | Archivo | Estado | Hallazgo principal |
|---|---|---|---|---|---|---|
| 1 | Landing pública | `/landing` | Público | `pages/landing/LandingPage.tsx` | ➖ N/A | Marketing con marca propia; no aplica bento de app. |
| 2 | Login | `/login` | Público | `pages/auth/LoginPage.tsx` | ✅ Cumple | Marca, validación de slug, formulario oculto si el cliente no existe y animación propia. |
| 3 | Inicio del cliente | `/` | Sesión de cliente | `pages/home/ClientHomePage.tsx` | ✅ Cumple | Hero pastel plano, KPIs con waves, accesos rápidos y primeros pasos compactos. |
| 4 | Inicio de plataforma | `/` sin cliente | ADMIN/SUPPORT | `pages/home/PlatformHomePage.tsx` | ✅ Cumple | KPIs, gráfica de altas, dona, cobros y `ITDataTable` de clientes. |
| 5 | Mi jornada | `/mi-jornada` | Personal | `pages/nom/MyWorkdayPage.tsx` | 🟡 Parcial | Bento correcto, pero el CTA principal de checada sigue en navy oscuro; sin tooltips. |
| 6 | Personal | `/employees` | `hr.records` | `pages/employees/EmployeesListPage.tsx` | ✅ Cumple | Filtros con `BentoFilterCards`, wave verde en activo y `ITDataTable`. |
| 7 | Alta de empleado | `/employees/new` | `users.create` | `pages/users/UserFormPage.tsx` | 🟡 Parcial | Pasos + resumen + acciones sticky, pero sin hero/contexto bento, sin HelpTip y botones pill (`!rounded-full`). |
| 8 | Importar personal | `/employees/import` | `users.create` | `pages/users/UserImportPage.tsx` | ❌ No cumple | Solo un `dropfile` en pantalla vacía: sin contexto, pasos, resumen ni ayuda. |
| 9 | Editar empleado | `/employees/:id/edit` | `users.edit` | `pages/users/UserFormPage.tsx` | 🟡 Parcial | Mismo formulario que el alta; correcto en campos, incompleto en contexto y tooltips. |
| 10 | Cuenta de acceso | `/employees/:id/account` | `users.edit` | `pages/users/UserAccountDialogPage` | 🟡 Parcial | Modal funcional con `ITSearchSelect`; sin lenguaje bento (es modal, no pantalla). |
| 11 | Expediente del empleado | `/employees/:id` | `hr.records` | `pages/employees/EmployeeDetailPage.tsx` | 🟡 Parcial | Cabecera pastel, tabs y tarjetas; chips viejos, sin panel lateral de resumen ni HelpTip. |
| 12 | Historial del empleado | `/employees/:id/history` | `hr.records` | `pages/users/UserHistoryPage.tsx` | 🟡 Parcial | Usa `ITBentoGrid/Donut` y una tarjeta oscura “Cuenta”; no sigue la regla pastel. |
| 13 | Expedientes y documentos | `/employees/records` | `hr.records` | `pages/employees/EmployeeRecordsPage.tsx` | ❌ No cumple | Tarjeta KPI navy + filtros legacy; la composición no es la de las pantallas nuevas. |
| 14 | Catálogo de documentos | `/employees/catalogs/documents` | `hr.records` | `pages/employees/DocumentCatalogPage.tsx` | 🟡 Parcial | Tabla funcional y ancha; falta contexto/KPIs y estados vacíos bento. |
| 15 | Reportes de RH | `/employees/disciplinary-reports` | `hr.records` | `pages/employees/HrReportsPage.tsx` | ❌ No cumple | `ITBentoStatStrip` legacy y panel colapsable; se ve vacío y fuera del patrón. |
| 16 | Detalle de reporte | `/employees/disciplinary-reports/:id` | `hr.records` | `pages/employees/DisciplinaryReportDetailPage.tsx` | 🟡 Parcial | Detalle simple sin hero, resumen lateral ni acciones bento. |
| 17 | Departamentos | `/departments` | `departments.view` | `pages/departments/DepartmentsPage.tsx` | ❌ No cumple | KPI navy + `ITBentoStatStrip` legacy; filtros no usan `BentoFilterCards`. |
| 18 | Detalle de departamento | `/departments/:id` | `departments.view` | `pages/departments/DepartmentDetailPage.tsx` | ❌ No cumple | Una tarjeta blanca pequeña en una pantalla casi vacía; sin contexto ni panel. |
| 19 | Subáreas | `/subareas` | `subareas.view` | `pages/subareas/SubareasPage.tsx` | 🟡 Parcial | Tabla ancha sin hero/KPIs; no rompe, pero no se siente bento. |
| 20 | Relojes (configuración) | `/time-clocks` | `time_clocks.manage` | `pages/access/TimeClocksPage.tsx` | 🟡 Parcial | Formularios y tablas funcionales; sin contexto/KPIs de flota. |
| 21 | Dashboard del reloj | `/time-clocks/dashboard` | `time_clocks.manage` | `pages/access/TimeClockDashboardPage.tsx` | ❌ No cumple | KPIs navy y strip legacy; sin HelpTip. |
| 22 | Personas del reloj | `/time-clocks/people` | `time_clocks.manage` | `pages/access/TimeClockPeoplePage.tsx` | 🟡 Parcial | Tabla dentro de tarjeta; sin contexto ni acciones compactas. |
| 23 | Inspeccionar reloj | `/time-clocks/inspect` | `time_clocks.manage` | `pages/access/TimeClockInspectPage.tsx` | 🟡 Parcial | Paneles blancos simples; falta jerarquía bento y estados. |
| 24 | Asistencia (reporte) | `/hr/time-clock` | `time_clock.view` | `pages/access/TimeClockPage.tsx` | ❌ No cumple | KPI navy + tabs y strip legacy; la pantalla más operativa queda fuera del bento actual. |
| 25 | Entradas y salidas | `/hr/time-clock/entries-exits` | `time_clock.view` | `pages/access/TimeClockReportPage.tsx` | ❌ No cumple | Tarjetas KPI de colores con strip legacy; falta unificar filtros y acciones. |
| 26 | Roster | `/hr/time-clock/roster` | `time_clock.view` | `pages/access/TimeClockRosterPage.tsx` | 🟡 Parcial | Tabla y reglas laterales; sin hero de contexto. |
| 27 | Empleados del reloj | `/hr/time-clock/employees` | `time_clock.view` | `pages/access/TimeClockEmployeesPage.tsx` | ❌ No cumple | Mezcla tarjetas pastel, strip legacy y botones oscuros. |
| 28 | Diferencias de reloj | `/hr/time-clock/employees/differences` | `time_clock.view` | `pages/access/TimeClockDifferencesPage.tsx` | 🟡 Parcial | Tarjetas y tabla; sin el patrón de filtros nuevo. |
| 29 | Horarios | `/schedules` | `schedules.view` | `pages/schedules/SchedulesPage.tsx` | 🟡 Parcial | Ya usa `BentoFilterCards`, pero conserva `FilterPills` duplicados y acciones de fila oscuras. |
| 30 | Formulario de horario | `/schedules/new`, `/schedules/:id/edit` | `schedules.edit` | `pages/schedules/ScheduleFormPage.tsx` | 🟡 Parcial | Formulario con resumen lateral; sin hero/HelpTip. |
| 31 | Asignar horarios | `/schedules/assign` | `schedules.view` | `pages/schedules/AssignSchedulesPage.tsx` | ❌ No cumple | Bloque KPI navy + `ITBentoStatStrip` legacy y tablero de dos columnas antiguo. |
| 32 | Tiempo extra | `/schedules/overtime/approval` | `overtime.view` | `pages/overtime/OvertimeApprovalPage.tsx` | ❌ No cumple | `ITBentoStatStrip` legacy y acciones oscuras; no sigue la regla de filtros. |
| 33 | Pre-nómina | `/schedules/payroll` | `payroll.view` | `pages/schedules/PayrollPage.tsx` | ✅ Cumple | Pantalla de referencia: tablas, filtros y resumen de nómina. |
| 34 | Historial de pre-nómina | `/schedules/payroll/history` | `payroll.view` | `pages/schedules/PayrollHistoryPage.tsx` | 🟡 Parcial | Historial vacío sin hero ni contexto; falta estado vacío bento. |
| 35 | Nómina configurable | `/payroll/settings` | `payroll.close` | `pages/payroll/PayrollSettingsPage.tsx` | ✅ Cumple | Hero pastel, secciones, resumen lateral, HelpTip y un solo guardar. |
| 36 | Convenios y acuerdos | `/hr/jornada-acuerdos` | `time_clock.write` | `pages/nom/WorkdayAgreementsPage.tsx` | 🟡 Parcial | Tarjetas y formulario correctos; sin hero ni tooltips. |
| 37 | Vacaciones y permisos | `/hr/leave` | `time_clock.write` | `pages/leave/LeaveAdminPage.tsx` | 🟡 Parcial | Bento con panel lateral; sin filtros nuevos y sin hero plano. |
| 38 | Teletrabajo | `/teletrabajo` | `time_clock.view` | `pages/nom/TeleworkAdminPage.tsx` | 🟡 Parcial | Grid de tarjetas, pero sin hero/contexto ni HelpTip. |
| 39 | Configuración del cliente | `/settings/general` | `time_clock.write` | `pages/settings/GeneralSettingsPage.tsx` | ✅ Cumple | Hero pastel plano, tarjetas, resumen sticky, HelpTip y guardar único. |
| 40 | Roles y permisos | `/roles` | `roles.manage` | `pages/roles/RolesPage.tsx` | ❌ No cumple | Hero navy, `RolesSummary` con strip legacy y matriz de permisos antigua. |
| 41 | Planes | `/plans` | `plans.view` | `pages/plans/PlansPage.tsx` | ❌ No cumple | KPI strip legacy y catálogo vacío sin contexto; no hay bento. |
| 42 | Notificaciones | `/notifications` | Sesión | `pages/notifications/NotificationsPage.tsx` | 🟡 Parcial | Hero pastel y lista/aside, pero el filtro activo usa bloque negro `#0f2e3d` (viola la regla). |
| 43 | Detalle de cliente (kardex) | `/tenants/:id` | ADMIN/SUPPORT | `pages/tenants/TenantDetailPage.tsx` | ✅ Cumple | Hero pastel, KPIs con waves, kardex paginado y formulario lateral. |

## Resumen

| Estado | Total |
|---|---:|
| ✅ Cumple | 8 |
| 🟡 Parcial | 21 |
| ❌ No cumple | 13 |
| ➖ No aplica | 1 |
| **Total** | **43** |

## Hallazgos transversales

1. **Filtros**: solo **Personal y Horarios** usan `BentoFilterCards`. Quedan **7 usos de `ITBentoStatStrip`** en Roles, Planes, Reportes RH, Asistencia, Entradas/Salidas, Empleados del reloj, Asignar horarios y Tiempo extra.
2. **Fondos oscuros**: ya no hay heroes negros, pero quedan tarjetas/KPIs navy en relojes, departamentos, expedientes, asignación y un filtro activo negro en Notificaciones.
3. **Tooltips**: `HelpTip` solo existe en **Configuración, Nómina configurable y Vacaciones**; 40 pantallas no explican campos complejos.
4. **Formularios**: alta/edición de empleado tiene buena estructura (pasos, resumen, sticky), pero usa botones pill y no tiene hero ni HelpTip; importar personal es solo un `dropfile`.
5. **Tablas**: las listas principales ya usan `ITDataTable` y **ninguna pantalla desborda horizontalmente**; quedan tablas custom en relojes/detalles.
6. **Estados vacíos**: varias pantallas casi vacías (importar, historial de pre-nómina, planes, reportes, detalle de departamento) no tienen un estado vacío bento con acción.
7. **Botones**: conviven CTA navy, botones pill y acciones de fila oscuras; falta la regla “icono para fila, texto pequeño para primaria”.
8. **Regla de filtros**: la tarjeta activa debe ser **wave verde + sombra**, sin borde; hoy solo se cumple en Personal.

## Prioridad sugerida

**P0 — pantallas operativas que más se usan**
1. `/hr/time-clock` y `/hr/time-clock/entries-exits`.
2. `/time-clocks/dashboard`, `/time-clocks/people`, `/time-clocks/inspect`.
3. `/departments` y `/departments/:id`.
4. `/schedules/assign` y `/schedules/overtime/approval`.
5. `/employees/records` y `/employees/disciplinary-reports`.

**P1 — administración**
6. `/roles` y `/plans`.
7. `/employees/import` y cuenta de acceso.
8. `/notifications` (filtro activo pastel/verde).
9. `/schedules` (quitar pills duplicados y acciones oscuras).

**P2 — detalles y formularios**
10. Expediente/historial/detalle de reporte, catálogo de documentos, convenios, teletrabajo y vacaciones: hero/contexto, HelpTip y estados vacíos.
11. Extender `HelpTip` a configuración de relojes, horarios, nómina y reglas de asistencia.

## Criterio de terminado por pantalla

- Ancho completo y grid bento, sin scroll horizontal.
- Hero/contexto pastel **o** fila de KPIs blancos con waves.
- Filtros con `BentoFilterCards` y activo con wave verde, sin borde.
- Tablas con paginación (`ITDataTable`) dentro de tarjeta.
- Formularios con resumen lateral, un solo guardar visible y HelpTip en lo complejo.
- Estados de carga/vacío/error con `ContentSkeleton`/Tic.
- `tsc` y lint en verde; E2E de la pantalla cuando exista.
