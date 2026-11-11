import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { tenantRouteFromLocation } from "@shared/api/tenant";
import RequiresPermission from "./guards/RequirePermission";
import TenantRouteGate from "./guards/TenantRouteGate";
import TenantOnly from "./guards/TenantOnly";


/** Cada pantalla es su propio chunk: la landing y el login no cargan el resto de la app. */
const LoginPage = lazy(() => import("@pages/auth/LoginPage"));
const PrivateRoutes = lazy(() => import("./guards/PrivateRoutes"));
const LandingPage = lazy(() => import("@pages/landing/LandingPage"));
const HomePage = lazy(() => import("@pages/home/HomePage"));
const TimeClockPage = lazy(() => import("@pages/access/TimeClockPage"));
const TimeClockReportPage = lazy(() => import("@pages/access/TimeClockReportPage"));
const TimeClockEmployeesPage = lazy(() => import("@pages/access/TimeClockEmployeesPage"));
const TimeClockRosterPage = lazy(() => import("@pages/access/TimeClockRosterPage"));
const TimeClockInspectPage = lazy(() => import("@pages/access/TimeClockInspectPage"));
const TimeClockPeoplePage = lazy(() => import("@pages/access/TimeClockPeoplePage"));
const TimeClockDashboardPage = lazy(() => import("@pages/access/TimeClockDashboardPage"));
const TimeClockDifferencesPage = lazy(() => import("@pages/access/TimeClockDifferencesPage"));
const TimeClocksPage = lazy(() => import("@pages/access/TimeClocksPage"));
const SchedulesPage = lazy(() => import("@pages/schedules/SchedulesPage"));
const ScheduleFormPage = lazy(() => import("@pages/schedules/ScheduleFormPage"));
const AssignSchedulesPage = lazy(() => import("@pages/schedules/AssignSchedulesPage"));
const OvertimeApprovalPage = lazy(() => import("@pages/overtime/OvertimeApprovalPage"));
const PayrollPage = lazy(() => import("@pages/schedules/PayrollPage"));
const DepartmentsPage = lazy(() => import("@pages/departments/DepartmentsPage"));
const DepartmentDetailPage = lazy(() => import("@pages/departments/DepartmentDetailPage"));
const SubareasPage = lazy(() => import("@pages/subareas/SubareasPage"));
const EmployeesListPage = lazy(() => import("@pages/employees/EmployeesListPage"));
const EmployeeRecordsPage = lazy(() => import("@pages/employees/EmployeeRecordsPage"));
const EmployeeDetailPage = lazy(() => import("@pages/employees/EmployeeDetailPage"));
const EmployeeProfileEditPage = lazy(() => import("@pages/employees/EmployeeProfileEditPage"));
const HrReportsPage = lazy(() => import("@pages/employees/HrReportsPage"));
const DisciplinaryReportDetailPage = lazy(() => import("@pages/employees/DisciplinaryReportDetailPage"));
const DocumentCatalogPage = lazy(() => import("@pages/employees/DocumentCatalogPage"));
const UserFormPage = lazy(() => import("@pages/users/UserFormPage"));
const UserHistoryPage = lazy(() => import("@pages/users/UserHistoryPage"));
const UserImportPage = lazy(() => import("@pages/users/UserImportPage"));
const NotificationsPage = lazy(() => import("@pages/notifications/NotificationsPage"));
const MyWorkdayPage = lazy(() => import("@pages/nom/MyWorkdayPage"));
const TeleworkAdminPage = lazy(() => import("@pages/nom/TeleworkAdminPage"));
const RolesPage = lazy(() => import("@pages/roles/RolesPage"));
const PlansPage = lazy(() => import("@pages/plans/PlansPage"));
const GeneralSettingsPage = lazy(() => import("@pages/settings/GeneralSettingsPage"));
const AuditLogPage = lazy(() => import("@pages/audit/AuditLogPage"));
const CatalogsPage = lazy(() => import("@pages/settings/CatalogsPage"));
const LeaveAdminPage = lazy(() => import("@pages/leave/LeaveAdminPage"));
const WorkdayAgreementsPage = lazy(() => import("@pages/nom/WorkdayAgreementsPage"));
const PayrollSettingsPage = lazy(() => import("@pages/payroll/PayrollSettingsPage"));
const AssignPayrollPositionPage = lazy(() => import("@pages/payroll/AssignPayrollPositionPage"));
const TenantDetailPage = lazy(() => import("@pages/tenants/TenantDetailPage"));
const TenantCreatePage = lazy(() => import("@pages/tenants/TenantCreatePage"));
const TenantsListPage = lazy(() => import("@pages/tenants/TenantsListPage"));
const PayrollHistoryPage = lazy(() => import("@pages/schedules/PayrollHistoryPage"));

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
        <Route
          path="/login"
          element={
            <Suspense fallback={null}>
              <LoginPage />
            </Suspense>
          }
        />
      {/* Landing pública (marketing); el inicio de la app sigue en "/" tras login. */}
      <Route
        path="/landing"
        element={
          <Suspense fallback={null}>
            <LandingPage />
          </Suspense>
        }
      />

        <Route
          element={
            <Suspense fallback={null}>
              <PrivateRoutes />
            </Suspense>
          }
        >
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
          path="/audit"
          element={
            <RequiresPermission permission="audit.view">
              <AuditLogPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/settings/catalogs"
          element={
            <RequiresPermission permission={["time_clock.write", "hr.records"]}>
              <CatalogsPage />
            </RequiresPermission>
          }
        />
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
          path="/tenants"
          element={
            <RequiresPermission permission="tenants.view">
              <TenantsListPage />
            </RequiresPermission>
          }
        />
        <Route
          path="/tenants/new"
          element={
            <RequiresPermission permission="tenants.manage">
              <TenantCreatePage />
            </RequiresPermission>
          }
        />
        <Route
          path="/tenants/:id"
          element={
            <RequiresPermission permission="tenants.view">
              <TenantDetailPage />
            </RequiresPermission>
          }
        />

        <Route
          path="/payroll/assign"
          element={
            <RequiresPermission permission="payroll.close">
              <AssignPayrollPositionPage />
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
