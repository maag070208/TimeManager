/**
 * Formato de horas de la pre-nómina semanal (PAY-01): horas decimales del Excel,
 * h:mm y claves de día sin corrimientos de zona.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayLabel,
  hoursDecimal,
  toDayKey,
  workedTime,
} from "./weeklyAttendanceFormat.ts";

test("[PAY-01] hoursDecimal deja dos decimales como el Excel", () => {
  assert.equal(hoursDecimal(0), "0.00");
  assert.equal(hoursDecimal(480), "8.00");
  assert.equal(hoursDecimal(513), "8.55");
  assert.equal(hoursDecimal(45), "0.75");
});

test("[PAY-01] workedTime recorta el cero inicial y conserva la hora", () => {
  assert.equal(workedTime(480), "8:00");
  assert.equal(workedTime(65), "1:05");
  assert.equal(workedTime(9), "0:09");
  assert.equal(workedTime(0), "0:00");
});

test("[PAY-01] toDayKey arma la clave local con ceros", () => {
  assert.equal(toDayKey(new Date(2026, 0, 5, 12)), "2026-01-05");
  assert.equal(toDayKey(new Date(2026, 10, 30, 23, 59)), "2026-11-30");
});

test("[PAY-01] dayLabel invierte la clave a dd/mm/aaaa", () => {
  assert.equal(dayLabel("2026-11-05"), "05/11/2026");
  assert.equal(dayLabel("2026-01-09"), "09/01/2026");
});
