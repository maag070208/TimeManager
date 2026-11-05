import { api } from "@shared/api/client";
import type {
  AttendanceTodayWidget,
  HrRecordsWidget,
  OvertimeWeekWidget,
  PeopleWidget,
  SetupGapsWidget,
} from "../model/types";

export const dashboardApi = {
  hrRecords: () => api.get<HrRecordsWidget>(`/dashboard/hr-records`),
  people: () => api.get<PeopleWidget>(`/dashboard/people`),
  attendanceToday: () => api.get<AttendanceTodayWidget>(`/dashboard/attendance-today`),
  overtimeWeek: () => api.get<OvertimeWeekWidget>(`/dashboard/overtime-week`),
  setupGaps: () => api.get<SetupGapsWidget>(`/dashboard/setup-gaps`),
  /** Le avisa al empleado (notificación + correo) qué le falta de su expediente. */
  notifyMissingRecords: (userId: string) => api.post<{ notified: boolean; emailed: boolean }>(`/hr/${userId}/notify-missing-records`, {}),
  /** "Avisar a pendientes": aviso masivo; las personas con expediente completo se omiten. */
  notifyMissingRecordsBulk: (userIds: string[]) =>
    api.post<{ notified: number; emailed: number; skipped: number }>(`/hr/notify-missing-records`, { userIds }),
};
