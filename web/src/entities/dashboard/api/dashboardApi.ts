import { api } from "@shared/api/client";
import type {
  AccessTodayWidget,
  AttendanceTodayWidget,
  DashboardSummary,
  HrRecordsWidget,
  MyEquipmentWidget,
  OvertimeWeekWidget,
  PeopleWidget,
  SetupGapsWidget,
  SystemHealthWidget,
  TasksWidget,
  TicketsWidget,
} from "../model/types";

export const dashboardApi = {
  getSummary: () => api.get<DashboardSummary>(`/dashboard/summary`),
  hrRecords: () => api.get<HrRecordsWidget>(`/dashboard/hr-records`),
  people: () => api.get<PeopleWidget>(`/dashboard/people`),
  attendanceToday: () => api.get<AttendanceTodayWidget>(`/dashboard/attendance-today`),
  overtimeWeek: () => api.get<OvertimeWeekWidget>(`/dashboard/overtime-week`),
  setupGaps: () => api.get<SetupGapsWidget>(`/dashboard/setup-gaps`),
  tickets: () => api.get<TicketsWidget>(`/dashboard/tickets`),
  tasks: () => api.get<TasksWidget>(`/dashboard/tasks`),
  myEquipment: () => api.get<MyEquipmentWidget>(`/dashboard/my-equipment`),
  accessToday: () => api.get<AccessTodayWidget>(`/dashboard/access-today`),
  systemHealth: () => api.get<SystemHealthWidget>(`/dashboard/system-health`),
  /** Le avisa al empleado (notificación + correo) qué le falta de su expediente. */
  notifyMissingRecords: (userId: string) => api.post<{ notified: boolean; emailed: boolean }>(`/hr/${userId}/notify-missing-records`, {}),
  /** "Avisar a pendientes": aviso masivo; las personas con expediente completo se omiten. */
  notifyMissingRecordsBulk: (userIds: string[]) =>
    api.post<{ notified: number; emailed: number; skipped: number }>(`/hr/notify-missing-records`, { userIds }),
};
