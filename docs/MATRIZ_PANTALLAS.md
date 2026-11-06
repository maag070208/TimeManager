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
| 2 | Login | `/login` | Público | `pages/auth/LoginPage.tsx` | ✅ Cumple | Marca, validación de slug y formulario oculto si el cliente no existe. |
| 3 | Inicio del cliente | `/` | Sesión de cliente | `pages/home/ClientHomePage.tsx` | ✅ Cumple | Hero pastel plano, KPIs con waves y accesos rápidos. |
| 4 | Inicio de plataforma | `/` sin cliente | ADMIN/SUPPORT | `pages/home/PlatformHomePage.tsx` | ✅ Cumple | KPIs, gráfica, dona, cobros y `ITDataTable` de clientes. |
| 5 | Mi jornada | `/mi-jornada` | Personal | `pages/nom/MyWorkdayPage.tsx` | ✅ Cumple | CTA pastel/verde y HelpTips en checada web y cumplimiento. |
| 6 | Personal | `/employees` | `hr.records` | `pages/employees/EmployeesListPage.tsx` | ✅ Cumple | `BentoFilterCards` con wave verde y `ITDataTable`. |
| 7 | Alta de empleado | `/employees/new` | `users.create` | `pages/users/UserFormPage.tsx` | ✅ Cumple | Pasos, resumen lateral, HelpTip y un solo guardar rectangular. |
| 8 | Importar personal | `/employees/import` | `users.create` | `pages/users/UserImportPage.tsx` | ✅ Cumple | Tarjeta bento de carga, pasos y HelpTip de plantilla. |
| 9 | Editar empleado | `/employees/:id/edit` | `users.edit` | `pages/users/UserFormPage.tsx` | ✅ Cumple | Mismo formulario P4 con acciones compactas. |
| 10 | Cuenta de acceso | `/employees/:id/account` | `users.edit` | `pages/employees` (diálogo) | 🟡 Parcial | Modal funcional con `ITSearchSelect`; no es una pantalla bento. |
| 11 | Expediente del empleado | `/employees/:id` | `hr.records` | `pages/employees/EmployeeDetailPage.tsx` | ✅ Cumple | Hero pastel, tabs, tarjetas y acciones compactas. |
| 12 | Historial del empleado | `/employees/:id/history` | `hr.records` | `pages/users/UserHistoryPage.tsx` | ✅ Cumple | Hero pastel, `BentoKpiGrid`, paneles de actividad y distribución. |
| 13 | Expedientes y documentos | `/employees/records` | `hr.records` | `pages/employees/EmployeeRecordsPage.tsx` | ✅ Cumple | `BentoKpiGrid`, `BentoFilterCards` y `ITDataTable` paginada. |
| 14 | Catálogo de documentos | `/employees/catalogs/documents` | `hr.records` | `pages/employees/DocumentCatalogPage.tsx` | ✅ Cumple | KPIs, HelpTip, estado vacío con acción y acciones de fila compactas. |
| 15 | Reportes de RH | `/employees/disciplinary-reports` | `hr.records` | `pages/employees/HrReportsPage.tsx` | 🟡 Parcial | Filtros nuevos; sin datos sembrados solo se ve el estado vacío. |
| 16 | Detalle de reporte | `/employees/disciplinary-reports/:id` | `hr.records` | `pages/employees/DisciplinaryReportDetailPage.tsx` | ✅ Cumple | `BentoKpiGrid` de contexto y resumen lateral. |
| 17 | Departamentos | `/departments` | `departments.view` | `pages/departments/DepartmentsPage.tsx` | ✅ Cumple | Filtros por estado/áreas, KPIs y mosaicos bento. |
| 18 | Detalle de departamento | `/departments/:id` | `departments.view` | `pages/departments/DepartmentDetailPage.tsx` | ✅ Cumple | KPIs y panel lateral con HelpTip. |
| 19 | Subáreas | `/subareas` | `subareas.view` | `pages/subareas/SubareasPage.tsx` | ✅ Cumple | Contexto con `BentoKpiGrid` y tabla paginada. |
| 20 | Relojes (configuración) | `/time-clocks` | `time_clocks.manage` | `pages/access/TimeClocksPage.tsx` | ✅ Cumple | KPIs, HelpTip de configuración y acciones compactas. |
| 21 | Dashboard del reloj | `/time-clocks/dashboard` | `time_clocks.manage` | `pages/access/TimeClockDashboardPage.tsx` | ✅ Cumple | `BentoKpiGrid`, tabs pastel y alertas accionables. |
| 22 | Personas del reloj | `/time-clocks/people` | `time_clocks.manage` | `pages/access/TimeClockPeoplePage.tsx` | ✅ Cumple | KPIs, HelpTip de vinculación y acciones compactas. |
| 23 | Inspeccionar reloj | `/time-clocks/inspect` | `time_clocks.manage` | `pages/access/TimeClockInspectPage.tsx` | ✅ Cumple | Tabla paginada, tabs pastel y HelpTip. |
| 24 | Asistencia (reporte) | `/hr/time-clock` | `time_clock.view` | `pages/access/TimeClockPage.tsx` | ✅ Cumple | KPIs con waves, filtros de asistencia y tabla. |
| 25 | Entradas y salidas | `/hr/time-clock/entries-exits` | `time_clock.view` | `pages/access/TimeClockReportPage.tsx` | ✅ Cumple | `BentoFilterCards` en lugar del strip y sin pills duplicados. |
| 26 | Roster | `/hr/time-clock/roster` | `time_clock.view` | `pages/access/TimeClockRosterPage.tsx` | ✅ Cumple | Contexto de padrón, tabla y HelpTip. |
| 27 | Empleados del reloj | `/hr/time-clock/employees` | `time_clock.view` | `pages/access/TimeClockEmployeesPage.tsx` | ✅ Cumple | `BentoFilterCards` de vínculos y acciones compactas. |
| 28 | Diferencias de reloj | `/hr/time-clock/employees/differences` | `time_clock.view` | `pages/access/TimeClockDifferencesPage.tsx` | ✅ Cumple | KPIs, HelpTip y tabla de diferencias. |
| 29 | Horarios | `/schedules` | `schedules.view` | `pages/schedules/SchedulesPage.tsx` | ✅ Cumple | `BentoFilterCards` único, HelpTip y acciones de fila compactas. |
| 30 | Formulario de horario | `/schedules/new`, `/schedules/:id/edit` | `schedules.edit` | `pages/schedules/ScheduleFormPage.tsx` | ✅ Cumple | Hero pastel con HelpTip de tolerancias y mínimo de horas extra. |
| 31 | Asignar horarios | `/schedules/assign` | `schedules.view` | `pages/schedules/AssignSchedulesPage.tsx` | ✅ Cumple | Filtros nuevos, `ITDataTable` con selección y acción compacta. |
| 32 | Tiempo extra | `/schedules/overtime/approval` | `overtime.view` | `pages/overtime/OvertimeApprovalPage.tsx` | ✅ Cumple | `BentoFilterCards` por estatus, HelpTip y sin tabs duplicados. |
| 33 | Pre-nómina | `/schedules/payroll` | `payroll.view` | `pages/schedules/PayrollPage.tsx` | ✅ Cumple | Pantalla de referencia; tablas, filtros y resumen. |
| 34 | Historial de pre-nómina | `/schedules/payroll/history` | `payroll.view` | `pages/schedules/PayrollHistoryPage.tsx` | 🟡 Parcial | Hero de página listo; el panel de detalle conserva retícula propia. |
| 35 | Nómina configurable | `/payroll/settings` | `payroll.close` | `pages/payroll/PayrollSettingsPage.tsx` | ✅ Cumple | Hero pastel, HelpTip y un solo guardar por viewport. |
| 36 | Convenios y acuerdos | `/hr/jornada-acuerdos` | `time_clock.write` | `pages/nom/WorkdayAgreementsPage.tsx` | ✅ Cumple | Hero pastel con conteos y HelpTips de art. 58. |
| 37 | Vacaciones y permisos | `/hr/leave` | `time_clock.write` | `pages/leave/LeaveAdminPage.tsx` | ✅ Cumple | Hero pastel, KPIs en el aside y filtros de estatus. |
| 38 | Teletrabajo | `/teletrabajo` | `time_clock.view` | `pages/nom/TeleworkAdminPage.tsx` | ✅ Cumple | Hero pastel y HelpTips de política/desconexión. |
| 39 | Configuración del cliente | `/settings/general` | `time_clock.write` | `pages/settings/GeneralSettingsPage.tsx` | ✅ Cumple | Hero pastel, tarjetas, resumen y HelpTip. |
| 40 | Roles y permisos | `/roles` | `roles.manage` | `pages/roles/RolesPage.tsx` | ✅ Cumple | KPIs bento, tabs pastel, HelpTip y estados vacíos con acción. |
| 41 | Planes | `/plans` | `plans.view` | `pages/plans/PlansPage.tsx` | 🟡 Parcial | KPIs, HelpTip y vacío con acción; falta paginar la tabla de planes. |
| 42 | Notificaciones | `/notifications` | Sesión | `pages/notifications/NotificationsPage.tsx` | ✅ Cumple | Filtros `BentoFilterCards`, activo con wave verde y CTA compacta. |
| 43 | Detalle de cliente (kardex) | `/tenants/:id` | ADMIN/SUPPORT | `pages/tenants/TenantDetailPage.tsx` | ✅ Cumple | Hero pastel, KPIs, kardex paginado y formulario lateral. |

## Resumen

| Estado | Total |
|---|---:|
| ✅ Cumple | 38 |
| 🟡 Parcial | 4 |
| ❌ No cumple | 0 |
| ➖ No aplica | 1 |
| **Total** | **43** |

## Correcciones aplicadas (2026-11-06)

- **Filtros**: `ITBentoStatStrip` eliminado de las pantallas; 13 usos de `BentoFilterCards`/`BentoKpiGrid`. La tarjeta activa usa **wave verde y sombra, sin borde**.
- **Sin fondos oscuros**: heroes y KPIs navy/negros eliminados de inicio, configuración, nómina, relojes, roles, planes, departamentos, expedientes y horarios; tabs activas ahora en pastel `#eaf6ef`.
- **Tablas**: expedientes, inspección/cámara, resumen de pre-nómina, checadas y asignación migradas a `ITDataTable` paginada. Sin scroll horizontal de página.
- **Formularios**: alta/edición de empleado con pasos, resumen lateral, HelpTip y botones rectangulares; importación con tarjeta de carga, pasos y plantilla.
- **Detalles**: historial de empleado, expediente, acta, convenios, teletrabajo y vacaciones con hero/KPIs/paneles bento.
- **Tooltips**: `HelpTip` agregado en configuración de relojes, permisos, planes, documentos, tolerancias, horas extra, convenios, teletrabajo y checada web.
- **Verificación**: `npx tsc -b` OK, `npx vite build` OK, `eslint` 0 errores (11 warnings preexistentes).

## Pendientes reales

1. **Cuenta de acceso**: sigue siendo un diálogo, no una pantalla bento; es un patrón modal aceptado.
2. **Reportes RH**: con cero datos solo se ve el estado vacío; conviene sembrar un reporte demo para validar visualmente filtros y tabla.
3. **Historial de pre-nómina**: el panel de detalle conserva retícula propia (no `ITDataTable`).
4. **Planes**: la tabla de planes no tiene paginación (`ITDataTable`).
5. **Tooltips**: los textos nuevos son literales en español; si se requiere i18n en inglés, faltan claves en shared.
6. **E2E**: no se ejecutó la suite completa; los selectores de tiempo extra se actualizaron a las tarjetas nuevas.

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
