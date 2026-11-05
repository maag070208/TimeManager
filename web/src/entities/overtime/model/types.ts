import type { OvertimePdfMeta } from "@entities/schedule";

/** Estado de aprobación de un día de tiempo extra. La ausencia de decisión = PENDIENTE. */
export type OvertimeDayStatus = "PENDING" | "APPROVED" | "REJECTED";
/** Un día de tiempo extra (persona + día) con su estado de aprobación. */
export interface OvertimeDayRow {
  userId: string;
  employeeName: string;
  employeeNumber: string | null;
  departmentId: string | null;
  departmentName: string | null;
  active: boolean;
  /** Día local `YYYY-MM-DD`. */
  date: string;
  extraMin: number;
  workedMin: number;
  scheduledMin: number;
  scheduleName: string | null;
  restDay: boolean;
  withoutSchedule: boolean;
  /** Turno programado del día ("14:00-22:00"); null en descanso o sin horario. */
  shift: string | null;
  /** Última salida del día (ISO) según el reloj. */
  exitAt: string | null;
  status: OvertimeDayStatus;
  /** Minutos contabilizados (snapshot aprobado). */
  approvedExtraMin: number;
  note: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface OvertimeDepartmentMinutes {
  departmentId: string | null;
  departmentName: string | null;
  minutes: number;
}

export interface OvertimeSummary {
  totalDays: number;
  pendingDays: number;
  approvedDays: number;
  rejectedDays: number;
  pendingMinutes: number;
  approvedMinutes: number;
  rejectedMinutes: number;
  peopleWithPending: number;
  /** Minutos de extra (no rechazados) por departamento, de mayor a menor. */
  byDepartment: OvertimeDepartmentMinutes[];
  range: { start: string; end: string; timezone: string; period: string };
}

export interface OvertimeQueryResponse {
  data: OvertimeDayRow[];
  total: number;
  page: number;
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  summary: OvertimeSummary;
}

export interface OvertimeDecideInput {
  filters: Record<string, string | number | boolean>;
  items: Array<{ userId: string; date: string }>;
  status: OvertimeDayStatus;
  note?: string;
}

export interface OvertimeDecideResult {
  updated: number;
  skipped: number;
}

/**
 * Carga del PDF de tiempo extra: replica la tabla de días de la pantalla
 * (persona + día) tal como se ve, con sus filtros y su orden.
 */
export interface OvertimePdfPayload {
  rows: OvertimeDayRow[];
  summary: OvertimeSummary;
  meta: OvertimePdfMeta;
  /** ADMIN/GERENTE ven los minutos calculados; RH solo los aprobados. */
  canApprove: boolean;
}
