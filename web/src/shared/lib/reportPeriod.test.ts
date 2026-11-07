/**
 * Periodos de reportes (CLK-02 Entradas y salidas / OT-01 Tiempo extra):
 * navegación Día/Semana/Quincena/Mes y rango del periodo con la semana del
 * cliente. Fechas locales para no depender de la TZ del equipo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_PERIODS,
  periodRangeOf,
  shiftPeriod,
  toDateInput,
} from "./reportPeriod.ts";

const local = (y: number, m: number, d: number): Date => new Date(y, m - 1, d, 12, 0, 0);

test("[CLK-02] toDateInput produce YYYY-MM-DD con ceros", () => {
  assert.equal(toDateInput(local(2026, 1, 5)), "2026-01-05");
  assert.equal(toDateInput(local(2026, 11, 30)), "2026-11-30");
});

test("[CLK-02] shiftPeriod mueve día, semana y mes", () => {
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 5), "DAY", 1)), "2026-11-06");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 5), "DAY", -1)), "2026-11-04");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 5), "WEEK", 1)), "2026-11-12");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 5), "WEEK", -1)), "2026-10-29");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 20), "MONTH", 1)), "2026-12-01");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 20), "MONTH", -1)), "2026-10-01");
});

test("[CLK-02] shiftPeriod recorre la quincena 1–15 ↔ 16–fin de mes", () => {
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 5), "FORTNIGHT", 1)), "2026-11-16");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 20), "FORTNIGHT", -1)), "2026-11-01");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 20), "FORTNIGHT", 1)), "2026-12-01");
  assert.equal(toDateInput(shiftPeriod(local(2026, 11, 5), "FORTNIGHT", -1)), "2026-10-16");
});

test("[CLK-02] periodRangeOf: día y semana con inicio configurable", () => {
  const [dayStart, dayEnd] = periodRangeOf(local(2026, 11, 5), "DAY", 1);
  assert.equal(toDateInput(dayStart), "2026-11-05");
  assert.equal(toDateInput(dayEnd), "2026-11-05");

  const [monday, sunday] = periodRangeOf(local(2026, 11, 5), "WEEK", 1);
  assert.equal(toDateInput(monday), "2026-11-02", "jueves 5 → lunes 2");
  assert.equal(toDateInput(sunday), "2026-11-08");

  const [wednesday] = periodRangeOf(local(2026, 11, 5), "WEEK", 3);
  assert.equal(toDateInput(wednesday), "2026-11-04", "semana que inicia miércoles");
});

test("[CLK-02] periodRangeOf: mes completo y quincenas", () => {
  const [monthStart, monthEnd] = periodRangeOf(local(2026, 2, 14), "MONTH", 1);
  assert.equal(toDateInput(monthStart), "2026-02-01");
  assert.equal(toDateInput(monthEnd), "2026-02-28", "febrero 2026 no es bisiesto");

  const [firstHalfStart, firstHalfEnd] = periodRangeOf(local(2026, 11, 5), "FORTNIGHT", 1);
  assert.equal(toDateInput(firstHalfStart), "2026-11-01");
  assert.equal(toDateInput(firstHalfEnd), "2026-11-15");

  const [secondHalfStart, secondHalfEnd] = periodRangeOf(local(2026, 11, 20), "FORTNIGHT", 1);
  assert.equal(toDateInput(secondHalfStart), "2026-11-16");
  assert.equal(toDateInput(secondHalfEnd), "2026-11-30");
});

test("[OT-01] el orden de los periodos del segmentado es estable", () => {
  assert.deepEqual(REPORT_PERIODS, ["DAY", "WEEK", "FORTNIGHT", "MONTH"]);
});
