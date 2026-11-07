/**
 * Reglas de horarios (días, legalidad LFT, turno) y vigencia de asignaciones
 * (una sola vigente por día). Funciones puras de `workday-rules.ts` y
 * `schedule-assignments.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKeyOf,
  minutesBetween,
  shiftTypeOf,
  toMinutes,
  toUtcDate,
  validateScheduleLegality,
  weekdayOf,
} from "./workday-rules";
import { scheduleOn, type LoadedAssignment } from "./schedule-assignments";

const day = (weekday: number, extra: Partial<Record<string, unknown>> = {}) => ({
  weekday,
  startTime: "09:00",
  endTime: "18:00",
  splitStartTime: null,
  splitEndTime: null,
  restDay: false,
  ...extra,
});

test("[SCH-01][SCH-02][ACT-21] valida una semana legal de 5 días (2026)", () => {
  const result = validateScheduleLegality({ days: [1, 2, 3, 4, 5].map((d) => day(d)), mealBreakMin: 60 }, 2026);
  assert.equal(result.valid, true);
  assert.equal(result.weeklyMinutes, 40 * 60);
  assert.equal(result.legalWeeklyMinutes, 48 * 60);
  assert.equal(result.maxDailyMinutes, 8 * 60);
});

test("[SCH-02][ACT-21] rechaza 7 días sin descanso y semanas sobre el máximo legal", () => {
  const sevenDays = validateScheduleLegality({ days: [1, 2, 3, 4, 5, 6, 7].map((d) => day(d)), mealBreakMin: 60 }, 2026);
  assert.equal(sevenDays.valid, false);
  assert.ok(sevenDays.violations.includes("SIN_DIA_DE_DESCANSO"));

  // 5 días × 10 h = 50 h: ilegal en 2026 (48 h) y en 2027 (46 h).
  const longWeek = [1, 2, 3, 4, 5].map((d) => day(d, { endTime: "20:00" }));
  for (const year of [2026, 2027]) {
    const result = validateScheduleLegality({ days: longWeek, mealBreakMin: 60 }, year);
    assert.equal(result.valid, false, String(year));
    assert.ok(result.violations.includes("SEMANA_MAYOR_LEGAL"));
  }
  const legal46 = validateScheduleLegality({ days: [1, 2, 3, 4, 5].map((d) => day(d)), mealBreakMin: 60 }, 2027);
  assert.equal(legal46.legalWeeklyMinutes, 46 * 60);
});

test("[SCH-02][SCH-M01][ACT-21] rechaza jornadas >12 h y avisa descanso/fuera de estándar", () => {
  const tooLong = validateScheduleLegality(
    { days: [{ ...day(1), startTime: "06:00", endTime: "20:00" }], mealBreakMin: 0 },
    2026
  );
  assert.equal(tooLong.valid, false);
  assert.ok(tooLong.violations.includes("DIA_MAYOR_12H:1"));

  const continuous6h = validateScheduleLegality({ days: [day(1)], mealBreakMin: 0 }, 2026);
  assert.ok(continuous6h.warnings.includes("DESCANSO_NO_DECLARADO:1"));

  const longDay = validateScheduleLegality({ days: [day(1, { endTime: "19:00" })], mealBreakMin: 60 }, 2026);
  assert.ok(longDay.warnings.includes("DIA_MAYOR_ESTANDAR:1"));
});

test("[SCH-02] reglas de días: minutos, día de la semana y fecha UTC-medianoche", () => {
  assert.equal(toMinutes("08:30"), 8 * 60 + 30);
  assert.equal(toMinutes(null), 0);
  assert.equal(minutesBetween("09:00", "18:00"), 9 * 60);
  assert.equal(minutesBetween("22:00", "06:00"), 8 * 60, "cruza medianoche");
  assert.equal(weekdayOf("2026-11-09"), 1, "2026-11-09 es lunes");
  assert.equal(weekdayOf("2026-11-15"), 7, "domingo = 7");
  assert.equal(dateKeyOf(toUtcDate("2026-11-09")), "2026-11-09");
});

test("[SCH-02] tipo de turno art. 60: diurna, nocturna y mixta", () => {
  assert.equal(shiftTypeOf(day(1)), "DIURNA");
  assert.equal(
    shiftTypeOf({ startTime: "22:00", endTime: "06:00", splitStartTime: null, splitEndTime: null }),
    "NOCTURNA"
  );
  assert.equal(
    shiftTypeOf({ startTime: "14:00", endTime: "22:00", splitStartTime: null, splitEndTime: null }),
    "MIXTA",
    "2 h nocturnas (< 3.5 h) sobre 8 h es mixta"
  );
  assert.equal(
    shiftTypeOf({ startTime: "18:00", endTime: "02:00", splitStartTime: null, splitEndTime: null }),
    "NOCTURNA",
    "más de la mitad nocturna"
  );
  assert.equal(shiftTypeOf(null), null);
});

const schedule = (name: string, days = [day(1)]) => ({
  id: name,
  name,
  entryToleranceMin: 0,
  exitToleranceMin: 0,
  mealBreakMin: 0,
  minOvertimeMin: 0,
  crossesMidnight: false,
  days,
});

const assignment = (
  id: string,
  userId: string,
  validFrom: string,
  validTo: string | null,
  name: string
): LoadedAssignment =>
  ({
    id,
    userId,
    scheduleId: name,
    validFrom: toUtcDate(validFrom),
    validTo: validTo ? toUtcDate(validTo) : null,
    createdAt: toUtcDate(validFrom),
    createdById: null,
    schedule: schedule(name),
  }) as unknown as LoadedAssignment;

test("[SCH-03][SCH-04][SCH-M03][ACT-23] una sola asignación vigente por día (gana la última)", () => {
  const assignments = [
    assignment("a1", "user-1", "2026-11-01", "2026-11-09", "Matutino"),
    assignment("a2", "user-1", "2026-11-10", null, "Vespertino"),
  ];
  assert.equal(scheduleOn(assignments, "user-1", "2026-11-05")?.name, "Matutino");
  assert.equal(scheduleOn(assignments, "user-1", "2026-11-10")?.name, "Vespertino");
  assert.equal(scheduleOn(assignments, "user-1", "2026-11-09")?.name, "Matutino", "validTo inclusivo");
});

test("[SCH-03][SCH-M03][ACT-23] reasignación encimada: manda la vigencia más reciente", () => {
  const assignments = [
    assignment("old", "user-1", "2026-11-01", null, "Matutino"),
    assignment("new", "user-1", "2026-11-05", null, "Vespertino"),
  ];
  // Aunque la vieja siga abierta (bug de reasignación hacia atrás), la nueva gana.
  assert.equal(scheduleOn(assignments, "user-1", "2026-11-06")?.name, "Vespertino");
  // Una asignación futura no adelanta el horario de hoy.
  assert.equal(scheduleOn([assignment("future", "user-1", "2026-11-20", null, "Nocturno")], "user-1", "2026-11-06"), null);
  // Usuario sin asignación o día fuera de vigencia: sin horario.
  assert.equal(scheduleOn(assignments, "user-2", "2026-11-06"), null);
  assert.equal(scheduleOn([assignment("expired", "user-1", "2026-10-01", "2026-10-31", "Matutino")], "user-1", "2026-11-06"), null);
});
