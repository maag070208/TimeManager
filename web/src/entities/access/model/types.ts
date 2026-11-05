export type AccessEventType = "ENTRY" | "EXIT";

export type AccessLocationSource = "GPS" | "SITE_ONLY" | "MANUAL";

export type AccessMethod = "QR_SCAN" | "MANUAL";

export interface AccessGuardRef {
  id: string;
  name: string;
}

export interface AccessSiteRef {
  id: string;
  name: string;
}

/** Evento de acceso registrado al escanear una credencial (o alta manual). */
export interface AccessEvent {
  id: string;
  type: AccessEventType;
  /** Hora autoritativa del servidor. */
  occurredAt: string;
  /** Hora reportada por el dispositivo; solo auditoría. */
  deviceTimestamp: string | null;
  employeeId: string;
  employeeNameSnapshot: string | null;
  employeeNumberSnapshot: string | null;
  guardId: string | null;
  guard?: AccessGuardRef | null;
  siteId: string | null;
  site?: AccessSiteRef | null;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  locationSource: AccessLocationSource;
  method: AccessMethod;
  credentialVersion: number | null;
  scannedPayloadHash?: string | null;
  clientEventId: string | null;
  deviceId: string | null;
  deviceCode: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidedById: string | null;
  voidReason: string | null;
  createdAt: string;
}

/** Sitio / portería del catálogo de control de acceso. */
export interface Site {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Conteos para los KPIs de la bitácora (POST /access/stats). */
export interface AccessStats {
  total: number;
  entries: number;
  exits: number;
  voided: number;
}

// ---------------------------------------------------------------------------
// Reporte de entradas/salidas por persona (POST /access/report)
// ---------------------------------------------------------------------------

/** Granularidad del reporte: define la ventana (la quincena es 1–15 y 16–fin de mes). */
export type AccessReportPeriod = "DAY" | "WEEK" | "FORTNIGHT" | "MONTH";

/**
 * Incidencia de una sesión derivada del emparejamiento ENTRY/EXIT.
 * - `ENTRY_WITHOUT_EXIT`: entrada que quedó sin salida (anomalía).
 * - `EXIT_WITHOUT_ENTRY`: salida sin entrada previa (anomalía).
 * - `OPEN_ENTRY`: entrada abierta de un periodo en curso ("En sitio").
 */
export type AccessIncidentCode =
  | "ENTRY_WITHOUT_EXIT"
  | "EXIT_WITHOUT_ENTRY"
  | "OPEN_ENTRY";

/** Detalle diario de una persona (atribuido por el día local de su `entryAt`). */
export interface AccessReportDay {
  date: string;
  entryAt: string | null;
  exitAt: string | null;
  workedMinutes: number;
  sessions: number;
  incidents: AccessIncidentCode[];
  /** `true` si alguna sesión del día cruzó la medianoche local. */
  crossesMidnight: boolean;
}

/** Una fila por persona. `days[]` solo se materializa en las filas de la página. */
export interface AccessReportPersonRow {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  active: boolean;
  hasRecords: boolean;
  firstEntryAt: string | null;
  lastExitAt: string | null;
  workedMinutes: number;
  sessionCount: number;
  daysWithRecords: number;
  incidents: AccessIncidentCode[];
  days: AccessReportDay[];
}

/** Una fila por SESIÓN (entrada + salida) del periodo. Es la fila del reporte. */
export interface AccessReportSessionRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  active: boolean;
  date: string;
  entryAt: string | null;
  exitAt: string | null;
  workedMinutes: number;
  incident: AccessIncidentCode | null;
  crossesMidnight: boolean;
  /**
   * Solo en el reporte del reloj checador (`/checador/report`): `false` si el
   * número del reloj aún no está vinculado a un usuario.
   */
  linked?: boolean;
}

/** Rango de fechas resuelto por el servidor en la zona horaria efectiva. */
export interface AccessReportRange {
  start: string;
  end: string;
  timezone: string;
  period: AccessReportPeriod;
}

/** Resumen global del reporte (no depende de la página devuelta). */
export interface AccessReportSummary {
  peopleTotal: number;
  peopleWithRecords: number;
  peopleWithoutRecords: number;
  peopleInside: number;
  totalWorkedMinutes: number;
  totalIncidents: number;
  range: AccessReportRange;
}

/** Respuesta paginada de `/access/report` y de `/access/report/export`. */
export interface AccessReportTableResponse {
  data: AccessReportSessionRow[];
  total: number;
  summary: AccessReportSummary;
}

/** Metadatos de la exportación a PDF (periodo de referencia y zona horaria). */
export interface AccessReportPdfMeta {
  period: AccessReportPeriod;
  date: string;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Entradas y salidas por persona (POST /schedules/attendance/{access,time-clock})
// ---------------------------------------------------------------------------

/**
 * Estado de un día contra el horario de la persona:
 * `ATTENDED` asistió · `LATE` con retardo · `ABSENCE` falta · `REST` descanso ·
 * `PENDING` futuro o de hoy antes de su entrada · `NO_INFO` sin horario ni registros.
 */
export type AttendanceDayStatus = "ATTENDED" | "LATE" | "ABSENCE" | "REST" | "PENDING" | "NO_INFO";

export interface PeopleAttendanceDay {
  date: string;
  status: AttendanceDayStatus;
  entryAt: string | null;
  exitAt: string | null;
  /** Incluye lo que lleva una entrada abierta (en sitio). */
  workedMinutes: number;
  lateMinutes: number;
  onSite: boolean;
  incident: "ENTRY_WITHOUT_EXIT" | "EXIT_WITHOUT_ENTRY" | null;
}

/** Una fila por persona; `days` trae cada día del periodo (`summary.range.days`). */
export interface PeopleAttendanceRow {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  active: boolean;
  linked: boolean;
  days: PeopleAttendanceDay[];
  workedMinutes: number;
  onSite: boolean;
  hasRecords: boolean;
  lateDays: number;
  absences: number;
  withoutExit: number;
  withoutEntry: number;
}

/** Vistas rápidas de la tabla. */
export type PeopleAttendanceView = "ALL" | "INCIDENTS" | "ON_SITE" | "WITHOUT_RECORDS";

/** Totales de todas las personas del filtro (no dependen de la vista ni de la página). */
export interface PeopleAttendanceSummary {
  people: number;
  withRecords: number;
  withoutRecords: number;
  onSite: number;
  workedMinutes: number;
  lateDays: number;
  absences: number;
  withoutExit: number;
  withoutEntry: number;
  range: AccessReportRange & { days: string[]; today: string };
}

export interface PeopleAttendanceResponse {
  data: PeopleAttendanceRow[];
  total: number;
  summary: PeopleAttendanceSummary;
}
