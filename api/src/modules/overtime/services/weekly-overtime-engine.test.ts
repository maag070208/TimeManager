/**
 * Casos obligatorios del motor semanal de horas extra (plan F1, sección 1.4).
 * Cada caso usa números redondos en minutos para que la expectativa legal sea
 * explícita: doble, triple y excedente ilegal.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyWeeklyOvertime,
  shiftDailyLimitMinutes,
  type WeeklyOvertimeDayInput,
} from "./weekly-overtime-engine";

const WORKDAY = 8 * 60;

/** Día laboral con `extraMin` de tiempo extra exacto (sin tolerancias). */
const day = (
  date: string,
  extraMin: number,
  overrides: Partial<WeeklyOvertimeDayInput> = {}
): WeeklyOvertimeDayInput => ({
  date,
  scheduledMin: WORKDAY,
  workedMin: WORKDAY + extraMin,
  ...overrides,
});

/** Semana de lunes a domingo de 2027 (4-ene-2027 es lunes). */
const WEEK_2027 = ["2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08"];

test("caso 1: 2027, 3 días con 2 h extra → 6 h DOBLE", () => {
  const result = classifyWeeklyOvertime({
    days: WEEK_2027.slice(0, 3).map((date) => day(date, 120)),
  });
  assert.equal(result.otDoubleMin, 360);
  assert.equal(result.otTripleMin, 0);
  assert.equal(result.otIllegalMin, 0);
  assert.equal(result.ordinaryMin, 3 * WORKDAY);
});

test("caso 2: 2027, 4 días con 3 h extra (12 h) → 9 h DOBLE + 3 h TRIPLE", () => {
  const result = classifyWeeklyOvertime({
    days: WEEK_2027.slice(0, 4).map((date) => day(date, 180)),
  });
  assert.equal(result.otDoubleMin, 9 * 60);
  assert.equal(result.otTripleMin, 3 * 60);
  assert.equal(result.otIllegalMin, 0);
});

test("caso 3: 2027, 4 días con 4 h extra (16 h) → 9 h DOBLE + 4 h TRIPLE + 3 h ILEGAL", () => {
  const result = classifyWeeklyOvertime({
    days: WEEK_2027.slice(0, 4).map((date) => day(date, 240)),
  });
  assert.equal(result.otDoubleMin, 9 * 60);
  assert.equal(result.otTripleMin, 4 * 60);
  assert.equal(result.otIllegalMin, 3 * 60);
  assert.ok(result.violations.includes("EXCEDENTE_ILEGAL"));
});

test("caso 4: 2027, 5 días con 1 h extra → 4 h DOBLE + 1 h TRIPLE (5.º día)", () => {
  const result = classifyWeeklyOvertime({
    days: WEEK_2027.map((date) => day(date, 60)),
  });
  assert.equal(result.otDoubleMin, 4 * 60);
  assert.equal(result.otTripleMin, 60);
  assert.equal(result.otIllegalMin, 0);
});

test("caso 5: 2027, jornada de 6 h + 5 h extra en un día → 4 h DOBLE + 1 h TRIPLE", () => {
  const result = classifyWeeklyOvertime({
    days: [{ date: "2027-01-04", scheduledMin: 6 * 60, workedMin: 11 * 60 }],
  });
  assert.equal(result.otDoubleMin, 4 * 60);
  assert.equal(result.otTripleMin, 60);
  assert.equal(result.otIllegalMin, 0);
});

test("caso 6: 2027, horario de 48 h sin extra marcada → 2 h DOBLE + HORARIO_ILEGAL", () => {
  const result = classifyWeeklyOvertime({
    days: [
      "2027-01-04",
      "2027-01-05",
      "2027-01-06",
      "2027-01-07",
      "2027-01-08",
      "2027-01-09",
    ].map((date) => ({
      date,
      scheduledMin: WORKDAY,
      workedMin: WORKDAY,
    })),
  });
  assert.equal(result.ordinaryMin, 46 * 60);
  assert.equal(result.otDoubleMin, 2 * 60);
  assert.equal(result.otTripleMin, 0);
  assert.ok(result.violations.includes("HORARIO_ILEGAL"));
});

test("caso 7: 2028, 4 días con 3 h extra → 10 h DOBLE + 2 h TRIPLE", () => {
  const result = classifyWeeklyOvertime({
    days: ["2028-01-03", "2028-01-04", "2028-01-05", "2028-01-06"].map((date) =>
      day(date, 180)
    ),
  });
  assert.equal(result.otDoubleMin, 10 * 60);
  assert.equal(result.otTripleMin, 2 * 60);
  assert.equal(result.otIllegalMin, 0);
});

test("caso 8: 2030, 4 días con 4 h extra → 12 h DOBLE + 4 h TRIPLE", () => {
  const result = classifyWeeklyOvertime({
    days: ["2030-01-07", "2030-01-08", "2030-01-09", "2030-01-10"].map((date) =>
      day(date, 240)
    ),
  });
  assert.equal(result.otDoubleMin, 12 * 60);
  assert.equal(result.otTripleMin, 4 * 60);
  assert.equal(result.otIllegalMin, 0);
});

test("caso 9: 2027, 8 h + 5 h extra (13 h) → 4 h DOBLE + 1 h ILEGAL por tope de 12 h", () => {
  const result = classifyWeeklyOvertime({
    days: [{ date: "2027-01-04", scheduledMin: WORKDAY, workedMin: 13 * 60 }],
  });
  assert.equal(result.otDoubleMin, 4 * 60);
  assert.equal(result.otTripleMin, 0);
  assert.equal(result.otIllegalMin, 60);
  assert.ok(result.violations.includes("TOPE_DIARIO_12H"));
});

test("caso 10: 2027, trabajador de 17 años con 1 h extra → TRIPLE + MENOR", () => {
  const result = classifyWeeklyOvertime({
    days: [day("2027-01-04", 60)],
    ageAtWeekStart: 17,
  });
  assert.equal(result.otDoubleMin, 0);
  assert.equal(result.otTripleMin, 60);
  assert.ok(result.minor);
  assert.ok(result.violations.includes("MENOR"));
});

test("caso 11: 2027, turno nocturno 22:00-06:00 sin convenio → 1 h extra (7 h máx.)", () => {
  const result = classifyWeeklyOvertime({
    days: [
      {
        date: "2027-01-04",
        scheduledMin: WORKDAY,
        workedMin: WORKDAY,
        shiftType: "NOCTURNA",
      },
    ],
  });
  assert.equal(result.days[0].scheduledMin, 7 * 60);
  assert.equal(result.days[0].extraMin, 60);
  assert.equal(result.otDoubleMin, 60);
  assert.equal(shiftDailyLimitMinutes("NOCTURNA"), 7 * 60);
});

test("caso 12: igual al 11, con convenio art. 58 → sin extra", () => {
  const result = classifyWeeklyOvertime({
    days: [
      {
        date: "2027-01-04",
        scheduledMin: WORKDAY,
        workedMin: WORKDAY,
        shiftType: "NOCTURNA",
      },
    ],
    hasDistributionAgreement: true,
  });
  assert.equal(result.days[0].extraMin, 0);
  assert.equal(result.otDoubleMin, 0);
});

test("caso 13: 2027, trabaja su día de descanso 8 h → bolsa DESCANSO, no consume extra", () => {
  const result = classifyWeeklyOvertime({
    days: [
      {
        date: "2027-01-09",
        scheduledMin: 0,
        workedMin: WORKDAY,
        restDay: true,
      },
    ],
  });
  assert.equal(result.restDayWorkedMin, WORKDAY);
  assert.equal(result.otDoubleMin, 0);
  assert.equal(result.otTripleMin, 0);
});

test("caso 14: 2027, trabaja domingo → marca prima dominical", () => {
  const result = classifyWeeklyOvertime({
    days: [day("2027-01-10", 0)],
  });
  assert.equal(result.sundayWorked, true);
  assert.equal(result.days[0].sunday, true);
});

test("caso 15: semana que cruza el año (29-dic-2026 a 4-ene-2027) usa el tope más favorable", () => {
  const result = classifyWeeklyOvertime({
    days: [
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
      "2027-01-04",
    ].map((date) => ({ date, scheduledMin: WORKDAY, workedMin: WORKDAY })),
  });
  assert.equal(result.ordinaryMin, 46 * 60);
  assert.equal(result.legal.weeklyLimitMinutes, 46 * 60);
  assert.ok(result.violations.includes("HORARIO_ILEGAL"));
  assert.equal(result.otDoubleMin + result.otTripleMin + result.otIllegalMin, 10 * 60);
});

test("caso 16: 2027, 7 días seguidos con marcaje → SIN_DIA_DE_DESCANSO", () => {
  const result = classifyWeeklyOvertime({
    days: [
      "2027-01-04",
      "2027-01-05",
      "2027-01-06",
      "2027-01-07",
      "2027-01-08",
      "2027-01-09",
      "2027-01-10",
    ].map((date) => day(date, 0)),
    consecutiveWorkedDays: 7,
  });
  assert.ok(result.violations.includes("SIN_DIA_DE_DESCANSO"));
});

test("caso 17: 2027, lactancia con reducción de 1 h → jornada pactada 7 h sin faltante", () => {
  const result = classifyWeeklyOvertime({
    days: [{ date: "2027-01-04", scheduledMin: 7 * 60, workedMin: 7 * 60 }],
  });
  assert.equal(result.days[0].extraMin, 0);
  assert.equal(result.ordinaryMin, 7 * 60);
});

test("caso 18: 2027, salida 25 min después con mínimo de nómina de 60 → registra 25 min exactos", () => {
  const result = classifyWeeklyOvertime({
    days: [{ date: "2027-01-04", scheduledMin: WORKDAY, workedMin: WORKDAY + 25 }],
  });
  assert.equal(result.days[0].extraMin, 25);
  assert.equal(result.otDoubleMin, 25);
});

test("el excedente ilegal se paga (se contabiliza), no se descarta", () => {
  const result = classifyWeeklyOvertime({
    days: WEEK_2027.slice(0, 4).map((date) => day(date, 240)),
  });
  assert.ok(result.otIllegalMin > 0);
  assert.equal(
    result.ordinaryMin + result.otDoubleMin + result.otTripleMin + result.otIllegalMin,
    result.ordinaryMin + 16 * 60
  );
});
