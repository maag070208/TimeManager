// ── Widgets de los tableros por rol (`GET /dashboard/<widget>`) ─────────────

export type PermissionScopeValue = "NONE" | "OWN" | "AREA" | "ALL";

export interface RecordGapsRow {
  userId: string;
  name: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  missingRequired: Array<{ id: string; name: string }>;
  missingDocuments: Array<{ id: string; name: string }>;
  /** Claves de datos personales vacíos (`dashboard:profileFields.*`). */
  missingFields: string[];
  /** Catálogo completo con lo entregado (detalle del expediente). */
  requiredDocuments: Array<{ id: string; name: string; delivered: boolean }>;
  otherDocuments: Array<{ id: string; name: string; delivered: boolean }>;
  filledFields: string[];
}

export interface HrRecordsWidget {
  summary: { employees: number; complete: number; missingRequired: number; missingDocuments: number; missingFields: number };
  rows: RecordGapsRow[];
}

export interface PeopleWidget {
  date: string;
  timezone: string;
  active: number;
  hiresThisMonth: number;
  departuresThisMonth: number;
  birthdays: Array<{ userId: string; name: string; departmentName: string | null; date: string }>;
  anniversaries: Array<{ userId: string; name: string; departmentName: string | null; date: string; years: number }>;
  disciplinaryThisMonth: {
    count: number;
    latest: Array<{ id: string; reason: string; date: string; userId: string; name: string }>;
  } | null;
}

export type TodayStatus = "PRESENT" | "LATE" | "NOT_ARRIVED" | "NOT_YET" | "REST" | "NO_SCHEDULE" | "UNLINKED";

export interface AttendanceTodayRow {
  userId: string;
  name: string;
  employeeNumber: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: TodayStatus;
  onSite: boolean;
  entryAt: string | null;
  exitAt: string | null;
  lateMin: number;
  shift: string | null;
  scheduledStartAt: string | null;
}

export interface AttendanceTodayWidget {
  date: string;
  timezone: string;
  scope: PermissionScopeValue;
  counts: Record<TodayStatus, number> & { onSite: number; people: number };
  rows: AttendanceTodayRow[];
}

export interface OvertimeWeekWidget {
  range: { start: string; end: string; timezone: string; days: string[] };
  extraMin: number;
  approvedExtraMin: number;
  pendingExtraMin: number;
  rejectedExtraMin: number;
  topPending: Array<{ userId: string; name: string; departmentName: string | null; pendingExtraMin: number }>;
}

export interface SetupGapsWidget {
  unlinkedClockNumbers: number;
  personalWithoutClock: number;
  personalWithoutSchedule: number;
}
