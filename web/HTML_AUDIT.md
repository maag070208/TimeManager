# Auditoría de HTML a mano (solo UI system)

Generado por `python3 -I web/scripts/audit-raw-html.py --report`.
Mide etiquetas crudas donde el kit ya tiene componente, **sin** contar la landing
pública, los generadores de PDF/HTML para imprimir ni cocina (oculta).

**Total: 838 etiquetas crudas en 162 archivos**
(div 589 · p 0 · span 76 · style 173).

## Por categoría

| Categoría | Cuántas | Reemplazo correcto |
|---|---:|---|
| Layout (`<div className="flex/grid…">`) | 265 | `ITFlex`, `ITStack`, `ITGrid` |
| Texto (`<p>`, `<span>`, `<b>`, `<small>`, `<h1..6>`) | 81 | `ITText` (con `as`, `muted`) |
| Tablas (`<table>`, `<tr>`, `<td>`…) | 70 | `ITDataTable` |
| Controles (`<button>`, `<input>`, `<select>`) | 116 | `ITButton`, `ITInput`, `ITSelect` |
| Estilos de apariencia (`style={ color/bg/padding… }`) | 121 | tokens del kit o componente |

## Por capa

| Capa | Archivos | Etiquetas |
|---|---:|---:|
| `features` | 92 | 523 |
| `shared` | 36 | 128 |
| `pages` | 21 | 121 |
| `widgets` | 13 | 66 |

## Archivos con más HTML a mano

| Archivo | div | p | span | style | total |
|---|---:|---:|---:|---:|---:|
| `src/features/hr/employee-records-board/ui/EmployeeRecordsBoard.tsx` | 34 | 0 | 3 | 4 | 41 |
| `src/pages/inventory/NewMovementPage.tsx` | 19 | 0 | 2 | 17 | 38 |
| `src/features/inventory/audit/ui/InventoryMismatchesBoard.tsx` | 5 | 0 | 27 | 0 | 32 |
| `src/features/hr/employee-detail/ui/EmployeeProfileEditDialog.tsx` | 23 | 0 | 0 | 0 | 23 |
| `src/features/home/admin-dashboard/ui/AdminDashboard.tsx` | 16 | 0 | 1 | 4 | 21 |
| `src/shared/ui/date-picker-portal/DatePickerPortal.tsx` | 7 | 0 | 0 | 14 | 21 |
| `src/widgets/tickets/ticket-detail-modal/ui/TicketDetailModal.tsx` | 15 | 0 | 0 | 5 | 20 |
| `src/pages/inventory/DashboardPage.tsx` | 9 | 0 | 2 | 5 | 16 |
| `src/features/home/system-dashboard/ui/SystemDashboard.tsx` | 4 | 0 | 1 | 10 | 15 |
| `src/features/access/time-clock-people/ui/PersonDetailDialog.tsx` | 14 | 0 | 0 | 0 | 14 |
| `src/features/roles/roles-console/ui/access/UserAccessExplorer.tsx` | 13 | 0 | 1 | 0 | 14 |
| `src/features/roles/roles-console/ui/PolicyEditorDialog.tsx` | 12 | 0 | 1 | 0 | 13 |
| `src/features/ticket/kanban/ui/KanbanBoard.tsx` | 5 | 0 | 2 | 4 | 11 |
| `src/features/schedule/weekly-attendance/ui/WeeklyAttendancePanel.tsx` | 7 | 0 | 1 | 2 | 10 |
| `src/widgets/assistant/ui/LangostinAssistant.tsx` | 7 | 0 | 1 | 2 | 10 |
| `src/pages/inventory/DeviceTypesPage.tsx` | 7 | 0 | 0 | 2 | 9 |
| `src/pages/users/UserHistoryPage.tsx` | 7 | 0 | 0 | 2 | 9 |
| `src/features/home/clock-dashboard/ui/ClockDashboard.tsx` | 5 | 0 | 0 | 4 | 9 |
| `src/features/auth/login/ui/LoginBrandPanel.tsx` | 8 | 0 | 1 | 0 | 9 |
| `src/features/langostin/gallery/ui/LangostinGallery.tsx` | 8 | 0 | 0 | 1 | 9 |
| `src/shared/ui/langostin-chat/LangostinChat.tsx` | 4 | 0 | 2 | 3 | 9 |
| `src/shared/ui/kpi-tile/ui/KpiTile.tsx` | 8 | 0 | 0 | 1 | 9 |
| `src/pages/access/AccessPage.tsx` | 6 | 0 | 0 | 2 | 8 |
| `src/pages/inventory/LoanDetailPage.tsx` | 7 | 0 | 0 | 1 | 8 |
| `src/features/home/personal-dashboard/ui/PersonalDashboard.tsx` | 7 | 0 | 0 | 1 | 8 |
| `src/features/home/role-dashboard/ui/WidgetCard.tsx` | 7 | 0 | 0 | 1 | 8 |
| `src/features/schedule/schedules-table/ui/SchedulesBoard.tsx` | 4 | 0 | 0 | 4 | 8 |
| `src/features/roles/roles-console/ui/access/AccessSimulator.tsx` | 8 | 0 | 0 | 0 | 8 |
| `src/features/roles/roles-console/ui/roles/RolePermissionsEditor.tsx` | 6 | 0 | 2 | 0 | 8 |
| `src/features/roles/roles-console/ui/shared/SidebarPreview.tsx` | 6 | 0 | 2 | 0 | 8 |
| `src/features/roles/roles-console/ui/shared/PendingChanges.tsx` | 6 | 0 | 2 | 0 | 8 |
| `src/features/hr/employee-clock/ui/FingerprintEnrollDialog.tsx` | 4 | 0 | 2 | 2 | 8 |
| `src/features/ticket/ticket-detail/ui/TaskAgentForm.tsx` | 5 | 0 | 2 | 1 | 8 |
| `src/shared/ui/charts/StackedBar.tsx` | 4 | 0 | 1 | 3 | 8 |
| `src/features/schedule/schedule-form/ui/ScheduleForm.tsx` | 7 | 0 | 0 | 0 | 7 |
| `src/features/schedule/overtime-approval/ui/OvertimeApprovalTable.tsx` | 6 | 0 | 0 | 1 | 7 |
| `src/features/roles/roles-console/ui/PermissionFormDialog.tsx` | 7 | 0 | 0 | 0 | 7 |
| `src/features/roles/roles-console/ui/matrix/PermissionMatrixPanel.tsx` | 3 | 0 | 3 | 1 | 7 |
| `src/features/department/departments-list/ui/DepartmentsCatalog.tsx` | 3 | 0 | 0 | 4 | 7 |
| `src/widgets/loan-agent/ui/LoanAgent.tsx` | 7 | 0 | 0 | 0 | 7 |
| `src/pages/inventory/DeviceDetailPage.tsx` | 6 | 0 | 0 | 0 | 6 |
| `src/pages/employees/EmployeeProfileEditPage.tsx` | 3 | 0 | 0 | 3 | 6 |
| `src/features/schedule/schedule-form/ui/ScheduleAgent.tsx` | 6 | 0 | 0 | 0 | 6 |
| `src/features/access/time-clock/ui/TimeClockDeviceCard.tsx` | 5 | 0 | 1 | 0 | 6 |
| `src/features/roles/roles-console/ui/RoleEditorDialog.tsx` | 6 | 0 | 0 | 0 | 6 |
| `src/features/roles/roles-console/ui/shared/DialogParts.tsx` | 5 | 0 | 1 | 0 | 6 |
| `src/features/hr/employee-detail/ui/EmployeeDocumentsCard.tsx` | 3 | 0 | 0 | 3 | 6 |
| `src/features/hr/employee-detail/ui/EmployeeInfoCards.tsx` | 4 | 0 | 0 | 2 | 6 |
| `src/features/hr/employee-detail/ui/EmployeeActivity.tsx` | 2 | 0 | 0 | 4 | 6 |
| `src/features/ticket/ticket-detail/ui/TicketHero.tsx` | 6 | 0 | 0 | 0 | 6 |
| `src/widgets/assistant/ui/agents/EmployeeFormAgent.tsx` | 3 | 0 | 0 | 3 | 6 |
| `src/widgets/tickets/ticket-attachments/ui/TicketAttachments.tsx` | 5 | 0 | 0 | 1 | 6 |
| `src/shared/ui/tab-bar/ui/TabBar.tsx` | 2 | 0 | 2 | 2 | 6 |
| `src/shared/ui/charts/HBarChart.tsx` | 4 | 0 | 0 | 2 | 6 |
| `src/shared/ui/charts/DonutChart.tsx` | 1 | 0 | 1 | 4 | 6 |
| `src/shared/ui/bento-bits/MiniList.tsx` | 1 | 0 | 0 | 5 | 6 |
| `src/pages/inventory/NewLoanReturnPage.tsx` | 5 | 0 | 0 | 0 | 5 |
| `src/features/home/role-dashboard/ui/widgets/RecordsChartsWidget.tsx` | 5 | 0 | 0 | 0 | 5 |
| `src/features/schedule/assign/ui/AssignSchedules.tsx` | 5 | 0 | 0 | 0 | 5 |
| `src/features/access/time-clock-people/ui/PersonClockPanel.tsx` | 5 | 0 | 0 | 0 | 5 |

## Cómo se corrige (regla del dueño)

1. Texto → `ITText` (con `as` = p/span/b, `muted`, y `className` solo para tipografía o tokens).
2. Layout → `ITFlex` (`align`, `justify`, `gap`), `ITStack` (vertical), `ITGrid` (columnas).
3. Tarjeta → `ITCard`, `ITBentoTile`, `PanelCard`. Píldora → `ITChip`/`ITBentoPill`.
4. Tabla → `ITDataTable` con la canon (`defaultItemsPerPage={25}`, `rowHeight={50}`, `virtualized`).
5. Acción de fila → `RowAction` (solo ícono con fondo).
6. `style={{}}` solo para valores que vienen de datos (anchos, colores de serie).

Avance: volver a correr el script; el número tiene que bajar archivo por archivo.
