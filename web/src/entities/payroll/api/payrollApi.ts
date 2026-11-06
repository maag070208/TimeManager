import { api } from "@shared/api/client";
import type { PayrollCalculation, PayrollSettings } from "../model/types";

export const payrollApi = {
  settings: () => api.get<PayrollSettings>("/payroll/settings"),
  updateSettings: (input: Partial<PayrollSettings>) => api.put<PayrollSettings>("/payroll/settings", input),
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
