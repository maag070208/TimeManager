/**
 * Modelos que llevan `tenantId` y se filtran/inyectan por contexto.
 * La lista vive en un solo lugar: la extensión de Prisma y cualquier otra
 * pieza (workers, validaciones) la importan de aquí.
 *
 * - Los 22 de negocio: `tenantId` NOT NULL en BD.
 * - `User`/`AuditLog`/`EmailLog`: `tenantId` nullable (`null` = plataforma);
 *   con contexto de cliente se filtran a ese cliente igual que los demás.
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  "Department",
  "Subarea",
  "User",
  "DocumentType",
  "EmployeeDiscount",
  "EmployeeDocument",
  "Notification",
  "AuditLog",
  "DisciplinaryReport",
  "EmailLog",
  "Site",
  "AccessEvent",
  "Schedule",
  "ScheduleDay",
  "ScheduleAssignment",
  "PayrollWeekClosure",
  "PayrollDepartmentReview",
  "TimeClock",
  "TimeClockPunch",
  "TimeClockSyncEvent",
  "TimeClockEmployee",
  "RemovalCategory",
  "TimeClockRosterEntry",
  "TimeClockRosterRun",
  "OvertimeApproval",
  "WeeklyOvertimeLedger",
  "Holiday",
  "WorkRecordAgreement",
  "WorkRecordAcknowledgment",
  "OvertimeRequest",
  "Agent",
  "AgentJob",
  // NOM / LFT 2027 (F2-01..F2-04): ajustes de checadas, configuración por
  // cliente y alertas de límite de jornada.
  "PunchAdjustment",
  "NomSettings",
  "WorkdayLimitAlert",
  // F2-07/F2-08: marcaje remoto y NOM-037 teletrabajo.
  "RemotePunch",
  "TeleworkRegistration",
  "TeleworkChecklist",
  "TeleworkEquipmentDelivery",
  "TeleworkTraining",
  "TeleworkNotice",
  "TeleworkReversalRequest",
  "OutOfHoursContact",
]);

export const isTenantModel = (model: string): boolean => TENANT_MODELS.has(model);

/**
 * Tenant `demo` creado por la migración 20261105000000_tenancy con todo el
 * contenido backfilleado. Solo para seeds/mocks y pruebas; la app toma el
 * tenant del contexto (`currentTenantId`), nunca de aquí.
 */
export const DEMO_TENANT_ID = "3f8b2c1a-9d4e-4a7b-8c1d-2e5f6a7b8c9d";
