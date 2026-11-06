/**
 * Motor de nómina configurable. No hardcodea tablas fiscales: las recibe del
 * cliente (`payroll_settings`) y devuelve conceptos con su naturaleza. El
 * timbrado CFDI y la presentación ante el IMSS quedan fuera: la plataforma
 * calcula y conserva la evidencia; la integración externa es posterior.
 */
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

export interface PayrollConfig {
  currency: string;
  dailySalary?: number | null;
  sbcDaily?: number | null;
  umaDaily?: number | null;
  overtimeHourlyDivisor: number;
  overtimeDoubleHoursPerWeek: number;
  overtimeDoubleMultiplier: number;
  overtimeTripleMultiplier: number;
  aguinaldoDays: number;
  aguinaldoExemptUmas: number;
  vacationPremiumPct: number;
  primaVacacionalExemptUmas: number;
  valesMonthly?: number | null;
  valesExemptMonthly?: number | null;
  fondoAhorroPct?: number | null;
  fondoAhorroCapMonthly?: number | null;
  fondoAhorroExemptMonthly?: number | null;
  ptuRatePct: number;
  isrEnabled: boolean;
  isrBrackets?: PayrollIsrBracket[] | null;
  isrSubsidyMonthly?: number | null;
  imssEnabled: boolean;
  imssRates?: PayrollImssRate[] | null;
  primaAntiguedadDaysPerYear: number;
  primaAntiguedadCapDaily?: number | null;
  severanceMonths: number;
  severanceDaysPerYear: number;
}

export type PayrollTerminationType = "RESIGNATION" | "UNJUSTIFIED" | "JUSTIFIED" | "CONTRACT_END";

export interface PayrollFiniquito {
  type: PayrollTerminationType;
  years: number;
  pendingSalaryDays?: number;
  accruedVacationDays?: number;
}

export interface PayrollInput {
  periodStart: string;
  periodEnd: string;
  daysWorked?: number;
  dailySalary?: number | null;
  overtimeDoubleHours?: number;
  overtimeTripleHours?: number;
  vacationDays?: number;
  accruedVacationDays?: number;
  daysWorkedYear?: number;
  includeAguinaldo?: boolean;
  vales?: number | null;
  fondoAhorro?: number | null;
  ptuProfit?: number;
  ptuTotalDays?: number;
  ptuTotalSalary?: number;
  termination?: PayrollFiniquito;
}

export type PayrollConceptKind = "PERCEPTION" | "DEDUCTION" | "EMPLOYER";

export interface PayrollConcept {
  key: string;
  label: string;
  kind: PayrollConceptKind;
  amount: number;
  taxable: number;
  exempt: number;
}

export interface PayrollResult {
  currency: string;
  periodDays: number;
  dailySalary: number;
  hourlySalary: number;
  concepts: PayrollConcept[];
  perceptions: number;
  exempt: number;
  taxable: number;
  isr: number;
  imssWorker: number;
  imssEmployer: number;
  net: number;
  employerCost: number;
  warnings: string[];
}

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const daysBetween = (from: string, to: string): number => {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
};
const positive = (value: number | null | undefined): number => Math.max(0, Number(value) || 0);

export const calculatePayroll = (input: PayrollInput, config: PayrollConfig): PayrollResult => {
  const dailySalary = positive(input.dailySalary ?? config.dailySalary);
  if (dailySalary <= 0) throw new Error("PAYROLL_SALARY_REQUIRED");
  const periodDays = input.daysWorked ?? daysBetween(input.periodStart, input.periodEnd);
  const divisor = Math.max(1, config.overtimeHourlyDivisor);
  const hourly = dailySalary / divisor;
  const warnings: string[] = [];
  const concepts: PayrollConcept[] = [];
  const add = (key: string, label: string, kind: PayrollConceptKind, amount: number, taxable = amount, exempt = 0) => {
    const value = round(amount);
    if (value === 0) return;
    concepts.push({ key, label, kind, amount: value, taxable: round(taxable), exempt: round(exempt) });
  };

  add("SUELDO", "Sueldo ordinario", "PERCEPTION", dailySalary * periodDays);

  // Horas extra: el tope doble es configurable; el excedente se paga triple.
  const requestedDouble = positive(input.overtimeDoubleHours);
  const doubleHours = Math.min(requestedDouble, Math.max(0, config.overtimeDoubleHoursPerWeek));
  const tripleHours = positive(input.overtimeTripleHours) + Math.max(0, requestedDouble - doubleHours);
  add(
    "HORAS_EXTRA_DOBLE",
    "Horas extra dobles",
    "PERCEPTION",
    doubleHours * hourly * config.overtimeDoubleMultiplier
  );
  add(
    "HORAS_EXTRA_TRIPLE",
    "Horas extra triples",
    "PERCEPTION",
    tripleHours * hourly * config.overtimeTripleMultiplier
  );

  const uma = positive(config.umaDaily);
  const aguinaldo = input.includeAguinaldo
    ? dailySalary * config.aguinaldoDays * (Math.min(365, positive(input.daysWorkedYear ?? periodDays)) / 365)
    : 0;
  const aguinaldoExempt = Math.min(aguinaldo, uma * positive(config.aguinaldoExemptUmas));
  add("AGUINALDO", "Aguinaldo", "PERCEPTION", aguinaldo, aguinaldo - aguinaldoExempt, aguinaldoExempt);

  const vacationDays = positive(input.vacationDays);
  const prima = dailySalary * vacationDays * (config.vacationPremiumPct / 100);
  const primaExempt = Math.min(prima, uma * positive(config.primaVacacionalExemptUmas));
  add("PRIMA_VACACIONAL", "Prima vacacional", "PERCEPTION", prima, prima - primaExempt, primaExempt);

  if (input.termination) {
    const years = positive(input.termination.years);
    const pendingDays = positive(input.termination.pendingSalaryDays);
    const accruedVacations = positive(input.termination.accruedVacationDays);
    add("FINIQUITO_SUELDO", "Salario pendiente", "PERCEPTION", dailySalary * pendingDays);
    add("FINIQUITO_AGUINALDO", "Aguinaldo proporcional", "PERCEPTION", aguinaldo);
    add("FINIQUITO_VACACIONES", "Vacaciones proporcionales", "PERCEPTION", dailySalary * accruedVacations);
    add(
      "FINIQUITO_PRIMA",
      "Prima vacacional proporcional",
      "PERCEPTION",
      dailySalary * accruedVacations * (config.vacationPremiumPct / 100)
    );
    const cap = positive(config.primaAntiguedadCapDaily) || dailySalary;
    add(
      "PRIMA_ANTIGUEDAD",
      "Prima de antigüedad",
      "PERCEPTION",
      Math.min(dailySalary, cap) * years * config.primaAntiguedadDaysPerYear
    );
    if (input.termination.type === "UNJUSTIFIED") {
      add(
        "INDEMNIZACION",
        "Indemnización constitucional",
        "PERCEPTION",
        dailySalary * (config.severanceMonths * 30 + years * config.severanceDaysPerYear)
      );
    }
  }

  const vales = positive(input.vales ?? (config.valesMonthly ? config.valesMonthly * (periodDays / 30) : 0));
  const valesExempt = Math.min(
    vales,
    config.valesExemptMonthly ? config.valesExemptMonthly * (periodDays / 30) : 0
  );
  add("VALES", "Vales de despensa", "PERCEPTION", vales, vales - valesExempt, valesExempt);

  const fondoCapped =
    positive(input.fondoAhorro ?? (dailySalary * periodDays * positive(config.fondoAhorroPct)) / 100) || 0;
  const fondo = config.fondoAhorroCapMonthly
    ? Math.min(fondoCapped, config.fondoAhorroCapMonthly * (periodDays / 30))
    : fondoCapped;
  const fondoExempt = Math.min(
    fondo,
    config.fondoAhorroExemptMonthly ? config.fondoAhorroExemptMonthly * (periodDays / 30) : 0
  );
  add("FONDO_AHORRO", "Fondo de ahorro", "PERCEPTION", fondo, fondo - fondoExempt, fondoExempt);

  if (input.ptuProfit && input.ptuProfit > 0) {
    if (!input.ptuTotalDays || !input.ptuTotalSalary) {
      warnings.push("PTU sin días/salario totales: no se puede repartir");
    } else {
      const amount =
        input.ptuProfit *
        (config.ptuRatePct / 100) *
        (0.5 * (periodDays / input.ptuTotalDays) +
          0.5 * ((dailySalary * periodDays) / input.ptuTotalSalary));
      add("PTU", "PTU", "PERCEPTION", amount);
    }
  }

  const taxableRaw = concepts
    .filter((concept) => concept.kind === "PERCEPTION")
    .reduce((sum, concept) => sum + concept.taxable, 0);
  const exempt = concepts.reduce((sum, concept) => sum + concept.exempt, 0);
  const taxable = round(taxableRaw);

  let isr = 0;
  if (config.isrEnabled) {
    const brackets = config.isrBrackets ?? [];
    if (brackets.length === 0) throw new Error("PAYROLL_ISR_TABLE_REQUIRED");
    const bracket = [...brackets]
      .sort((a, b) => a.lower - b.lower)
      .filter((row) => taxable >= row.lower)
      .pop();
    if (bracket) {
      isr = Math.max(0, bracket.fixed + (taxable - bracket.lower) * bracket.rate);
      const subsidy = positive(config.isrSubsidyMonthly);
      isr = Math.max(0, isr - subsidy);
    }
  }
  if (isr > 0) {
    concepts.push({ key: "ISR", label: "ISR", kind: "DEDUCTION", amount: round(isr), taxable: 0, exempt: 0 });
  }

  let imssWorker = 0;
  let imssEmployer = 0;
  if (config.imssEnabled) {
    const rates = config.imssRates ?? [];
    if (rates.length === 0) throw new Error("PAYROLL_IMSS_TABLE_REQUIRED");
    const sbc = positive(config.sbcDaily) || dailySalary;
    const base = sbc * periodDays;
    for (const rate of rates) {
      const worker = base * (positive(rate.workerPct) / 100);
      const employer = base * (positive(rate.employerPct) / 100);
      imssWorker += worker;
      imssEmployer += employer;
      if (worker > 0) {
        concepts.push({
          key: `IMSS_${rate.key}`,
          label: `IMSS ${rate.label} (trabajador)`,
          kind: "DEDUCTION",
          amount: round(worker),
          taxable: 0,
          exempt: 0,
        });
      }
      if (employer > 0) {
        concepts.push({
          key: `IMSS_EMP_${rate.key}`,
          label: `IMSS ${rate.label} (patrón)`,
          kind: "EMPLOYER",
          amount: round(employer),
          taxable: 0,
          exempt: 0,
        });
      }
    }
  }

  const perceptions = round(
    concepts.filter((concept) => concept.kind === "PERCEPTION").reduce((sum, c) => sum + c.amount, 0)
  );
  const deductions = round(
    concepts.filter((concept) => concept.kind === "DEDUCTION").reduce((sum, c) => sum + c.amount, 0)
  );
  const net = round(perceptions - deductions);
  const employerCost = round(perceptions + imssEmployer);

  return {
    currency: config.currency,
    periodDays,
    dailySalary: round(dailySalary),
    hourlySalary: round(hourly),
    concepts,
    perceptions,
    exempt: round(exempt),
    taxable,
    isr: round(isr),
    imssWorker: round(imssWorker),
    imssEmployer: round(imssEmployer),
    net,
    employerCost,
    warnings,
  };
};
