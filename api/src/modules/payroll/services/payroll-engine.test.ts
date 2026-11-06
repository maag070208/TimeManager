import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePayroll, type PayrollConfig } from "./payroll-engine";

const config = (overrides: Partial<PayrollConfig> = {}): PayrollConfig => ({
  currency: "MXN",
  dailySalary: 315.04,
  sbcDaily: null,
  umaDaily: 0,
  overtimeHourlyDivisor: 8,
  overtimeDoubleHoursPerWeek: 9,
  overtimeDoubleMultiplier: 2,
  overtimeTripleMultiplier: 3,
  aguinaldoDays: 15,
  aguinaldoExemptUmas: 30,
  vacationPremiumPct: 25,
  primaVacacionalExemptUmas: 15,
  valesMonthly: null,
  valesExemptMonthly: null,
  fondoAhorroPct: null,
  fondoAhorroCapMonthly: null,
  fondoAhorroExemptMonthly: null,
  ptuRatePct: 10,
  isrEnabled: false,
  isrBrackets: null,
  isrSubsidyMonthly: null,
  imssEnabled: false,
  imssRates: null,
  primaAntiguedadDaysPerYear: 12,
  primaAntiguedadCapDaily: null,
  severanceMonths: 3,
  severanceDaysPerYear: 20,
  ...overrides,
});

const input = (overrides = {}) => ({
  periodStart: "2026-11-01",
  periodEnd: "2026-11-06",
  daysWorked: 6,
  ...overrides,
});

test("sueldo semanal con 315.04 diarios y 6 días", () => {
  const result = calculatePayroll(input(), config());
  assert.equal(result.dailySalary, 315.04);
  assert.equal(result.hourlySalary, 39.38);
  assert.equal(result.perceptions, 1890.24);
});

test("hora extra: 9 dobles y el excedente triple", () => {
  const result = calculatePayroll(input({ overtimeDoubleHours: 10 }), config());
  assert.equal(result.concepts.find((c) => c.key === "HORAS_EXTRA_DOBLE")?.amount, 708.84);
  assert.equal(result.concepts.find((c) => c.key === "HORAS_EXTRA_TRIPLE")?.amount, 118.14);
});

test("aguinaldo, prima vacacional y vales/fondo configurables", () => {
  const result = calculatePayroll(
    input({ includeAguinaldo: true, daysWorkedYear: 365, vacationDays: 6, vales: 1000, fondoAhorro: 500 }),
    config({ valesExemptMonthly: 500, fondoAhorroExemptMonthly: 300 })
  );
  assert.equal(result.concepts.find((c) => c.key === "AGUINALDO")?.amount, 4725.6);
  assert.equal(result.concepts.find((c) => c.key === "PRIMA_VACACIONAL")?.amount, 472.56);
  // Los topes exentos son mensuales y se prorratean a los 6 días del periodo.
  assert.equal(result.concepts.find((c) => c.key === "VALES")?.exempt, 100);
  assert.equal(result.concepts.find((c) => c.key === "FONDO_AHORRO")?.exempt, 60);
});

test("finiquito con indemnización y prima de antigüedad", () => {
  const result = calculatePayroll(
    input({
      termination: {
        type: "UNJUSTIFIED",
        years: 3,
        pendingSalaryDays: 2,
        accruedVacationDays: 6,
      },
    }),
    config()
  );
  assert.equal(result.concepts.find((c) => c.key === "FINIQUITO_SUELDO")?.amount, 630.08);
  assert.equal(result.concepts.find((c) => c.key === "PRIMA_ANTIGUEDAD")?.amount, 11341.44);
  assert.equal(result.concepts.find((c) => c.key === "INDEMNIZACION")?.amount, 47256);
});

test("ISR e IMSS usan tablas configurables", () => {
  const result = calculatePayroll(
    input(),
    config({
      isrEnabled: true,
      isrBrackets: [{ lower: 0, fixed: 0, rate: 0.1 }],
      imssEnabled: true,
      sbcDaily: 315.04,
      imssRates: [{ key: "EM", label: "Enfermedad", workerPct: 2, employerPct: 5 }],
    })
  );
  assert.equal(result.isr, 189.02);
  assert.equal(result.imssWorker, 37.8);
  assert.equal(result.imssEmployer, 94.51);
  assert.equal(result.net, 1663.42);
});

test("PTU reparte 50% días y 50% salario", () => {
  const result = calculatePayroll(
    input({ daysWorked: 30, ptuProfit: 100000, ptuTotalDays: 300, ptuTotalSalary: 300000 }),
    config()
  );
  assert.equal(result.concepts.find((c) => c.key === "PTU")?.amount, 657.52);
});

test("si ISR está activo sin tabla, falla explícitamente", () => {
  assert.throws(
    () => calculatePayroll(input(), config({ isrEnabled: true, isrBrackets: [] })),
    /PAYROLL_ISR_TABLE_REQUIRED/
  );
});

test("sin salario configurado falla explícitamente", () => {
  assert.throws(
    () => calculatePayroll(input(), config({ dailySalary: null })),
    /PAYROLL_SALARY_REQUIRED/
  );
});
