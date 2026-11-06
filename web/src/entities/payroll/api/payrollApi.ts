import { api } from "@shared/api/client";
import type { PayrollCalculation, PayrollPosition, PayrollSettings } from "../model/types";

export const payrollApi = {
  settings: () => api.get<PayrollSettings>("/payroll/settings"),
  updateSettings: (input: Partial<PayrollSettings>) => api.put<PayrollSettings>("/payroll/settings", input),
  positions: () => api.get<PayrollPosition[]>("/payroll/positions"),
  createPosition: (input: { name: string; jobTitle?: string | null; dailySalary: number; sbcDaily?: number | null }) =>
    api.post<PayrollPosition>("/payroll/positions", input),
  updatePosition: (id: string, input: { name?: string; jobTitle?: string | null; dailySalary?: number; sbcDaily?: number | null; active?: boolean }) =>
    api.patch<PayrollPosition>(`/payroll/positions/${id}`, input),
  assignPosition: (id: string, userIds: string[]) => api.put<PayrollPosition>(`/payroll/positions/${id}/assign`, { userIds }),
  calculate: (input: {
    periodStart: string;
    periodEnd: string;
    daysWorked?: number;
    dailySalary?: number | null;
    overtimeDoubleHours?: number;
    overtimeTripleHours?: number;
    includeAguinaldo?: boolean;
    daysWorkedYear?: number;
  }) => api.post<PayrollCalculation>("/payroll/calculate", input),
};
