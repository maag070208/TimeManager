/**
 * Reglas de nómina: topes legales de horas extra (dobles/triples), divisor,
 * conceptos configurables y validación de puestos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePayroll, type PayrollConfig } from "./payroll-engine";
import { PayrollPositionCreateDto, PayrollPositionAssignDto } from "../models/dto/payroll.dto";

const config = (overrides: Partial<PayrollConfig> = {}): PayrollConfig => ({
  currency: "MXN",
  dailySalary: 400,
  sbcDaily: 400,
  umaDaily: 108.57,
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

const concept = (result: ReturnType<typeof calculatePayroll>, key: string) =>
  result.concepts.find((item) => item.key === key);

test("[PAY-03][PAY-04][ACT-27] tope de 9 dobles: el excedente pasa a triple", () => {
  const result = calculatePayroll({ periodStart: "2026-11-01", periodEnd: "2026-11-07", daysWorked: 6, overtimeDoubleHours: 12 }, config());
  // hour = 400/8 = 50. 9 dobles × 2 × 50 = 900; 3 triples × 3 × 50 = 450.
  assert.equal(concept(result, "HORAS_EXTRA_DOBLE")?.amount, 900);
  assert.equal(concept(result, "HORAS_EXTRA_TRIPLE")?.amount, 450);
  assert.equal(result.perceptions, 2400 + 900 + 450);
});

test("[PAY-03][PAY-04] multiplicadores y divisor configurables por cliente", () => {
  const result = calculatePayroll({ periodStart: "2026-11-01", periodEnd: "2026-11-01", daysWorked: 1, overtimeDoubleHours: 2 }, config({
    dailySalary: 480,
    overtimeHourlyDivisor: 6,
    overtimeDoubleMultiplier: 2.5,
    overtimeDoubleHoursPerWeek: 20,
  }));
  assert.equal(concept(result, "HORAS_EXTRA_DOBLE")?.amount, 2 * (480 / 6) * 2.5);
  assert.equal(concept(result, "HORAS_EXTRA_TRIPLE"), undefined);
});

test("[PAY-01][PAY-02][PAY-03] sueldo del periodo + conceptos de aguinaldo y finiquito", () => {
  const result = calculatePayroll({ periodStart: "2026-11-01", periodEnd: "2026-11-07", daysWorked: 7, includeAguinaldo: true }, config());
  assert.equal(concept(result, "SUELDO")?.amount, 400 * 7);
  assert.ok(concept(result, "AGUINALDO"));

  const finiquito = calculatePayroll(
    { periodStart: "2026-11-01", periodEnd: "2026-11-30", daysWorked: 30, termination: { type: "UNJUSTIFIED", years: 3, pendingSalaryDays: 5 } },
    config()
  );
  assert.ok(finiquito.concepts.some((c) => c.key === "INDEMNIZACION"));
  assert.ok(finiquito.net > 0);
});

test("[PAY-03][PAY-M05][PAY-M06] puestos de nómina: DTO de alta y asignación", () => {
  const position = PayrollPositionCreateDto.safeParse({ name: "Operador", jobTitle: "Operador de máquina", dailySalary: 315.04 });
  assert.equal(position.success, true);
  assert.equal(PayrollPositionCreateDto.safeParse({ name: "A", dailySalary: 315 }).success, false, "nombre mínimo 2");
  assert.equal(PayrollPositionCreateDto.safeParse({ name: "Operador", dailySalary: -1 }).success, false, "sueldo positivo");
  assert.equal(PositionAssignOk({ userIds: ["5e1f0d9a-1c2b-4b3d-8e4f-123456789abc"] }), true);

  function PositionAssignOk(input: { userIds: string[] }): boolean {
    return PayrollPositionAssignDto.safeParse(input).success;
  }
  assert.equal(PositionAssignOk({ userIds: ["no-uuid"] }), false);
});
