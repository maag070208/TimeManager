import { api } from "@shared/api/client";
import { tableQuery, tableRequest, type ITDataTableFetchParamsPost } from "@shared/api/table";
import type {
  AssignmentRow,
  AssignedPerson,
  OvertimeResponse,
  PayrollClosureRow,
  PayrollReviewState,
  Schedule,
  ScheduleInput,
  WeeklyAttendanceQuery,
  WeeklyAttendanceReport,
} from "../model/types";

export const scheduleApi = {
  list: (includeInactive?: boolean) =>
    api.get<Schedule[]>(`/schedules${includeInactive ? "?includeInactive=true" : ""}`),
  create: (input: ScheduleInput) => api.post<Schedule>(`/schedules`, input),
  update: (id: string, input: Partial<ScheduleInput> & { active?: boolean }) =>
    api.patch<Schedule>(`/schedules/${id}`, input),
  remove: (id: string) =>
    api.delete<{ soft: boolean; data: Schedule }>(`/schedules/${id}`),

  /** Asignación masiva: un horario → N personas desde una fecha. */
  assign: (data: { scheduleId: string; userIds: string[]; from: string }) =>
    api.post<{ assigned: number; schedule: string; from: string }>(
      `/schedules/assignments`,
      data
    ),

  assignmentsTable: (params: ITDataTableFetchParamsPost) =>
    tableRequest<AssignmentRow>(`/schedules/assignments/query`, params),

  /** Personas con asignación vigente de un horario. */
  scheduleAssignees: (id: string) =>
    api.get<AssignedPerson[]>(`/schedules/${id}/assignees`),

  /** Quita (cierra la vigencia) la asignación de varias personas. */
  removeAssignments: (data: { scheduleId: string; userIds: string[] }) =>
    api.post<{ removed: number }>(`/schedules/assignments/remove`, data),

  /** Reporte semanal de asistencia de un departamento (RH). */
  weeklyAttendance: (query: WeeklyAttendanceQuery) =>
    api.post<WeeklyAttendanceReport>(`/schedules/weekly-attendance`, query),

  /** Universo completo sin paginar, SOLO aprobado (para CSV/KPIs/PDF). */
  overtimeExport: (params: ITDataTableFetchParamsPost) =>
    tableQuery<OvertimeResponse>(`/schedules/overtime/export`, params),

  // ── Pre-nómina: revisión por departamento y cierre de la semana ──────────

  payrollReviewState: (weekStart: string) =>
    api.get<PayrollReviewState>(`/schedules/payroll/review-state?weekStart=${weekStart}`),

  /** Marca o desmarca un departamento (revisión individual). */
  payrollSetReview: (data: { weekStart: string; departmentId: string | null; reviewed: boolean }) =>
    api.put<PayrollReviewState>(`/schedules/payroll/reviews`, data),

  /** «Marcar todo como revisado»: crea las revisiones que falten. */
  payrollReviewAll: (data: { weekStart: string; departmentIds: (string | null)[] }) =>
    api.post<PayrollReviewState>(`/schedules/payroll/reviews/mark-all`, data),

  payrollClose: (data: { weekStart: string; departmentIds: (string | null)[]; snapshot?: Record<string, unknown> }) =>
    api.post<PayrollReviewState>(`/schedules/payroll/close`, data),

  payrollReopen: (weekStart: string) =>
    api.post<PayrollReviewState>(`/schedules/payroll/reopen`, { weekStart }),

  /** Historial de cierres (más reciente primero). */
  payrollClosures: () => api.get<PayrollClosureRow[]>(`/schedules/payroll/closures`),
};
