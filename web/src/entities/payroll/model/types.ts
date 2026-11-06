export interface PayrollIsrBracket {
  lower: number;
  fixed: number;
  rate: number;
}

export interface PayrollImssRate {
  key: string;
  label: string;
  workerPct: number;
  employerPct: number;
}

export interface PayrollSettings {
  currency: string;
  defaultDailySalary: number | null;
  sbcDaily: number | null;
  umaDaily: number | null;
  overtimeHourlyDivisor: number;
  overtimeDoubleHoursPerWeek: number;
  overtimeDoubleMultiplier: number;
  overtimeTripleMultiplier: number;
  aguinaldoDays: number;
  aguinaldoExemptUmas: number;
  vacationPremiumPct: number;
  primaVacacionalExemptUmas: number;
  valesMonthly: number | null;
  valesExemptMonthly: number | null;
  fondoAhorroPct: number | null;
  fondoAhorroCapMonthly: number | null;
  fondoAhorroExemptMonthly: number | null;
  ptuRatePct: number;
  isrEnabled: boolean;
  isrBrackets: PayrollIsrBracket[] | null;
  isrSubsidyMonthly: number | null;
  imssEnabled: boolean;
  imssRates: PayrollImssRate[] | null;
  primaAntiguedadDaysPerYear: number;
  primaAntiguedadCapDaily: number | null;
  severanceMonths: number;
  severanceDaysPerYear: number;
}

export interface PayrollCalculation {
  currency: string;
  periodDays: number;
  dailySalary: number;
  hourlySalary: number;
  perceptions: number;
  exempt: number;
  taxable: number;
  isr: number;
  imssWorker: number;
  imssEmployer: number;
  net: number;
  employerCost: number;
  warnings: string[];
  concepts: Array<{
    key: string;
    label: string;
    kind: "PERCEPTION" | "DEDUCTION" | "EMPLOYER";
    amount: number;
    taxable: number;
    exempt: number;
  }>;
}
