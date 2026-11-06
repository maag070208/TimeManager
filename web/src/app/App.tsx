import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { tenantRouteFromLocation } from "@shared/api/tenant";
import LoginPage from "@pages/auth/LoginPage";
import LandingPage from "@pages/landing/LandingPage";
import HomePage from "@pages/home/HomePage";
import PrivateRoutes from "./guards/PrivateRoutes";
import RequiresPermission from "./guards/RequirePermission";
import TenantRouteGate from "./guards/TenantRouteGate";
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
import UserFormPage from "@pages/users/UserFormPage";
import UserHistoryPage from "@pages/users/UserHistoryPage";
import UserImportPage from "@pages/users/UserImportPage";
import NotificationsPage from "@pages/notifications/NotificationsPage";
import MyWorkdayPage from "@pages/nom/MyWorkdayPage";
import TenantOnly from "./guards/TenantOnly";
import TeleworkAdminPage from "@pages/nom/TeleworkAdminPage";
import RolesPage from "@pages/roles/RolesPage";
import PlansPage from "@pages/plans/PlansPage";
import GeneralSettingsPage from "@pages/settings/GeneralSettingsPage";
import LeaveAdminPage from "@pages/leave/LeaveAdminPage";
import WorkdayAgreementsPage from "@pages/nom/WorkdayAgreementsPage";
import PayrollSettingsPage from "@pages/payroll/PayrollSettingsPage";
import PayrollHistoryPage from "@pages/schedules/PayrollHistoryPage";

/** Personal se abre con expediente (`hr.records`) o con cuentas (`users.view`). */
const PEOPLE_PERMISSIONS = ["hr.records", "users.view"] as const;

function LegacyUserRedirect({ to }: { to: "account" | "history" }) {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/employees/${id}/${to}`} replace />;
}

/** Inicio: en modo ruta por cliente (`/#/acme/…`) el canónico es `/home`. */
function HomeRoute() {
  return tenantRouteFromLocation().fromPath ? <Navigate to="/home" replace /> : <HomePage />;
}

export default function App() {
  return (
    <>
      <TenantRouteGate />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      {/* Landing pública (marketing); el inicio de la app sigue en "/" tras login. */}
      <Route path="/landing" element={<LandingPage />} />

        <Route element={<PrivateRoutes />}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/home" element={<HomePage />} />
          {/* Portal del trabajador (NOM/F2-07): marcaje remoto, marcajes y teletrabajo. */}
          <Route path="/mi-jornada" element={<TenantOnly><MyWorkdayPage /></TenantOnly>} />
          <Route
            path="/teletrabajo"
            element={
              <RequiresPermission permission="time_clock.view">
                <TeleworkAdminPage />
              </RequiresPermission>
            }
          />

        
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/departments/:id" element={<DepartmentDetailPage />} />
        <Route path="/subareas" element={<SubareasPage />} />
        {/* Personal = cuentas + expedientes: una sola pantalla. */}
        <Route
          path="/employees"
          element={
            <RequiresPermission permission={PEOPLE_PERMISSIONS}>
              <EmployeesListPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/employees/:id/account"
          element={
            <RequiresPermission permission={PEOPLE_PERMISSIONS}>
              <EmployeesListPage />
            </RequiresPermission>
          }
        />
        <Route path="/employees/new" element={<RequiresPermission permission="users.create"><UserFormPage /></RequiresPermission>} />
        <Route path="/employees/import" element={<RequiresPermission permission="users.create"><UserImportPage /></RequiresPermission>} />
        <Route path="/employees/:id/history" element={<RequiresPermission permission={PEOPLE_PERMISSIONS}><UserHistoryPage /></RequiresPermission>} />
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
        {/* Usuarios se fundió en Personal: los enlaces viejos siguen funcionando. */}
        <Route path="/users" element={<Navigate to="/employees" replace />} />
        <Route path="/users/new" element={<Navigate to="/employees/new" replace />} />
        <Route path="/users/import" element={<Navigate to="/employees/import" replace />} />
        <Route path="/users/:id/edit" element={<LegacyUserRedirect to="account" />} />
        <Route path="/users/:id/history" element={<LegacyUserRedirect to="history" />} />
                <Route
          path="/roles"
          element={
            <RequiresPermission permission="roles.manage">
              <RolesPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/plans"
          element={
            <RequiresPermission permission="plans.view">
              <PlansPage />
            </RequiresPermission>
          }
        />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/settings/general"
          element={
            <RequiresPermission permission="time_clock.write">
              <GeneralSettingsPage />
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
          path="/payroll/settings"
          element={
            <RequiresPermission permission="payroll.close">
              <PayrollSettingsPage />
            </RequiresPermission>
          }
        />

        <Route
          path="/hr/jornada-acuerdos"
          element={
            <RequiresPermission permission="time_clock.write">
              <WorkdayAgreementsPage />
            </RequiresPermission>
          }
        />

        <Route
          path="/hr/leave"
          element={
            <RequiresPermission permission="time_clock.write">
              <LeaveAdminPage />
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
          path="/schedules/payroll/history"
          element={
            <RequiresPermission permission="payroll.view">
              <PayrollHistoryPage />
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
    </>
  );
}
