import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@pages/auth/LoginPage";
import PrivateRoutes from "./guards/PrivateRoutes";
import RequiresPermission from "./guards/RequirePermission";
import AccessPage from "@pages/access/AccessPage";
import AccessReportPage from "@pages/access/AccessReportPage";
import TimeClockPage from "@pages/access/TimeClockPage";
import TimeClockReportPage from "@pages/access/TimeClockReportPage";
import TimeClockEmployeesPage from "@pages/access/TimeClockEmployeesPage";
import TimeClockRosterPage from "@pages/access/TimeClockRosterPage";
import TimeClockInspectPage from "@pages/access/TimeClockInspectPage";
import TimeClockPeoplePage from "@pages/access/TimeClockPeoplePage";
import TimeClockDashboardPage from "@pages/access/TimeClockDashboardPage";
import TimeClockDifferencesPage from "@pages/access/TimeClockDifferencesPage";
import TimeClocksPage from "@pages/access/TimeClocksPage";
import SchedulesPage from "@pages/schedules/SchedulesPage";
import ScheduleFormPage from "@pages/schedules/ScheduleFormPage";
import AssignSchedulesPage from "@pages/schedules/AssignSchedulesPage";
import OvertimeApprovalPage from "@pages/overtime/OvertimeApprovalPage";
import PayrollPage from "@pages/schedules/PayrollPage";
import DepartmentsPage from "@pages/departments/DepartmentsPage";
import DepartmentDetailPage from "@pages/departments/DepartmentDetailPage";
import SubareasPage from "@pages/subareas/SubareasPage";
import EmployeesListPage from "@pages/employees/EmployeesListPage";
import EmployeeRecordsPage from "@pages/employees/EmployeeRecordsPage";
import EmployeeDetailPage from "@pages/employees/EmployeeDetailPage";
import EmployeeProfileEditPage from "@pages/employees/EmployeeProfileEditPage";
import HrReportsPage from "@pages/employees/HrReportsPage";
import DisciplinaryReportDetailPage from "@pages/employees/DisciplinaryReportDetailPage";
import DocumentCatalogPage from "@pages/employees/DocumentCatalogPage";
import UsersListPage from "@pages/users/UsersListPage";
import UserFormPage from "@pages/users/UserFormPage";
import UserHistoryPage from "@pages/users/UserHistoryPage";
import UserImportPage from "@pages/users/UserImportPage";
import NotificationsPage from "@pages/notifications/NotificationsPage";
import RolesPage from "@pages/roles/RolesPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<PrivateRoutes />}>
        <Route path="/" element={<Navigate to="/employees" replace />} />

        
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/departments/:id" element={<DepartmentDetailPage />} />
        <Route path="/subareas" element={<SubareasPage />} />
        <Route
          path="/employees"
          element={
            <RequiresPermission permission="hr.records">
              <EmployeesListPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/records"
          element={
            <RequiresPermission permission="hr.records">
              <EmployeeRecordsPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/catalogs/documents"
          element={
            <RequiresPermission permission="hr.records">
              <DocumentCatalogPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/:id/edit"
          element={
            <RequiresPermission permission="hr.records">
              <EmployeeProfileEditPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/disciplinary-reports"
          element={
            <RequiresPermission permission="hr.records">
              <HrReportsPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/disciplinary-reports/:id"
          element={
            <RequiresPermission permission="hr.records">
              <DisciplinaryReportDetailPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <RequiresPermission permission="hr.records">
              <EmployeeDetailPage />
            </RequiresPermission>
          }
        />
                <Route path="/users" element={<UsersListPage />} />
        <Route path="/users/new" element={<UserFormPage />} />
        {/* La edición es un diálogo sobre la lista; la ruta se conserva para que
            los enlaces directos (y el atajo del expediente) sigan abriéndolo. */}
        <Route path="/users/:id/edit" element={<UsersListPage />} />
        <Route path="/users/:id/history" element={<UserHistoryPage />} />
        <Route path="/users/import" element={<UserImportPage />} />
                <Route
          path="/roles"
          element={
            <RequiresPermission permission="roles.manage">
              <RolesPage />
            </RequiresPermission>
          }
        />
        <Route path="/notifications" element={<NotificationsPage />} />
        {/* Galería de la mascota (animaciones y escenarios): solo ADMIN. */}
        
        <Route
          path="/access"
          element={
            <RequiresPermission permission="access.log">
              <AccessPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/access/report"
          element={
            <RequiresPermission permission="access.log">
              <AccessReportPage />
            </RequiresPermission>
          }
        />
        {/* Reloj checador Hikvision (solo lectura; ver TIME_CLOCK.md). */}
        <Route
          path="/hr/time-clock"
          element={
            <RequiresPermission permission="time_clock.view">
              <TimeClockPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/hr/time-clock/entries-exits"
          element={
            <RequiresPermission permission="time_clock.view">
              <TimeClockReportPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/hr/time-clock/roster"
          element={
            <RequiresPermission permission="time_clock.view">
              <TimeClockRosterPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/hr/time-clock/employees"
          element={
            <RequiresPermission permission="time_clock.view">
              <TimeClockEmployeesPage />
            </RequiresPermission>
          }
        />
        {/* Conciliación en dos columnas: números del reloj contra personas del sistema. */}
        <Route
          path="/hr/time-clock/employees/differences"
          element={
            <RequiresPermission permission="time_clock.view">
              <TimeClockDifferencesPage />
            </RequiresPermission>
          }
        />
        {/* Dashboard del reloj (Configuración): estado, alertas y checadas de hoy. */}
        <Route
          path="/time-clocks/dashboard"
          element={
            <RequiresPermission permission="time_clocks.manage">
              <TimeClockDashboardPage />
            </RequiresPermission>
          }
        />
        {/* Personas y tarjetas del reloj (Configuración): CRUD; escribe en el reloj. */}
        <Route
          path="/time-clocks/people"
          element={
            <RequiresPermission permission="time_clocks.manage">
              <TimeClockPeoplePage />
            </RequiresPermission>
          }
        />
        {/* Lo que tiene el reloj (Configuración): personas, tarjetas y eventos del equipo, solo lectura. */}
        <Route
          path="/time-clocks/inspect"
          element={
            <RequiresPermission permission="time_clocks.manage">
              <TimeClockInspectPage />
            </RequiresPermission>
          }
        />
        {/* Relojes checadores (Configuración): alta, baja y configuración en vivo. */}
        <Route
          path="/time-clocks"
          element={
            <RequiresPermission permission="time_clocks.manage">
              <TimeClocksPage />
            </RequiresPermission>
          }
        />

        <Route
          path="/schedules"
          element={
            <RequiresPermission permission="schedules.view">
              <SchedulesPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/schedules/new"
          element={
            <RequiresPermission permission="schedules.view">
              <ScheduleFormPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/schedules/:id/edit"
          element={
            <RequiresPermission permission="schedules.view">
              <ScheduleFormPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/schedules/assign"
          element={
            <RequiresPermission permission="schedules.view">
              <AssignSchedulesPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/schedules/overtime/approval"
          element={
            <RequiresPermission permission="overtime.view">
              <OvertimeApprovalPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/schedules/payroll"
          element={
            <RequiresPermission permission="payroll.view">
              <PayrollPage />
            </RequiresPermission>
          }
        />

                                                                                                                                                                                              </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
