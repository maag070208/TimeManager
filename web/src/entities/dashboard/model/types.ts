export type DashboardActivityScope = "devices" | "tickets" | "custodyLetters" | "materialOutputs" | "inventory";

export interface DashboardActivity {
  id: string;
  scope: DashboardActivityScope;
  message: string;
  at: string;
  targetId?: string | null;
  deviceId?: string | null;
}

export interface DashboardSummary {
  devices: { total: number; available: number; assigned: number; retirement: number };
  tickets: { total: number; open: number; inProgress: number; closed: number };
  custodyLetters: { total: number; active: number };
  materialOutputs: { total: number; damaged: number };
  departments: number;
  employees: number;
  ticketMetrics: {
    resolvedTasks: number;
    pendingTasks: number;
    avgResolutionDays: number | null;
  };
  ticketEfficiency: {
    user: { id: string; name: string; jobTitle: string | null };
    resolved: number;
    pending: number;
    avgDays: number | null;
  }[];
  urgentTickets: {
    id: string;
    title: string;
    priority: TicketPriority;
    createdAt: string;
    daysOnHold: number;
    assigned: string | null;
  }[];
  recentActivity: DashboardActivity[];
}

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

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

export interface TicketsWidget {
  scope: PermissionScopeValue;
  open: number;
  inProgress: number;
  closed: number;
  unassigned: number;
  staleDays: number;
  stale: Array<{ id: string; title: string; priority: string; status: string; createdAt: string; assignedTo: string | null }>;
  openByAssignee: Array<{ userId: string; name: string; open: number }>;
}

export interface TasksWidget {
  scope: PermissionScopeValue;
  pending: number;
  inProgress: number;
  inReview: number;
  completed: number;
  overdue: Array<{ id: string; title: string; status: string; ticketId: string; dueDate: string | null; name: string }>;
  pendingByUser: Array<{ userId: string; name: string; pending: number }>;
}

export interface MyEquipmentWidget {
  loans: Array<{
    id: string;
    number: string;
    date: string;
    items: Array<{
      name: string;
      brand: string;
      model: string;
      pending: number;
      units: Array<{ assetTag: string; serialNumber: string | null }>;
    }>;
  }>;
}

export interface AccessTodayWidget {
  date: string;
  timezone: string;
  entries: number;
  exits: number;
  registeredByMe: number;
  onSite: Array<{ employeeId: string; name: string | null; since: string; site: string | null }>;
  latest: Array<{ id: string; type: "ENTRY" | "EXIT"; at: string; name: string | null; site: string | null; guard: string | null }>;
}

export interface SystemHealthWidget {
  inventoryAudit: { title: string; detail: string | null; at: string } | null;
  clocks: Array<{ serialNumber: string; name: string | null; syncedAt: string | null; countsAttendance: boolean }>;
  failedEmailsLast7Days: number;
  pendingEmails: number;
}
