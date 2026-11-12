/**
 * Resumen de un horario en el formulario (SCH-02 alta / SCH-03 edición):
 * minutos por día, comida, jornada partida y totales de la semana. Espeja la
 * fórmula del backend.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayMinutes,
  daysWorked,
  minutesBetween,
  restDays,
  suggestedName,
  weeklyMinutes,
} from "./summary.ts";
import type { ScheduleDayInput } from "@entities/schedule";

const workday = (patch: Partial<ScheduleDayInput> = {}): ScheduleDayInput => ({
  weekday: 1,
  startTime: "08:00",
  endTime: "17:00",
  restDay: false,
  ...patch,
});

test("[SCH-02] minutesBetween calcula la diferencia y maneja turnos que cruzan medianoche", () => {
  assert.equal(minutesBetween("08:00", "17:00"), 540);
  assert.equal(minutesBetween("22:00", "06:00"), 480, "cruce de medianoche");
  assert.equal(minutesBetween("09:00", "09:00"), 1440, "misma hora = jornada de 24 h");
  assert.equal(minutesBetween(null, "17:00"), 0);
  assert.equal(minutesBetween("08:00", null), 0);
});

test("[SCH-02] dayMinutes descuenta la comida y respeta el descanso", () => {
  assert.equal(dayMinutes(workday(), 60), 480);
  assert.equal(dayMinutes(workday({ restDay: true }), 60), 0);
  assert.equal(dayMinutes(workday({ startTime: null, endTime: null }), 60), 0);
});

test("[SCH-03] dayMinutes suma la jornada partida", () => {
  const split = workday({ splitStartTime: "13:00", splitEndTime: "15:00" });
  assert.equal(dayMinutes(split, 60), 540 + 120 - 60);
  assert.equal(dayMinutes(workday({ splitStartTime: "13:00", splitEndTime: null }), 0), 540, "sin fin no suma");
});

test("[SCH-03] weeklyMinutes suma los días laborables con el mismo descuento", () => {
  const days = [
    workday({ weekday: 1 }),
    workday({ weekday: 2, startTime: "08:00", endTime: "13:00" }),
    workday({ weekday: 3, restDay: true }),
  ];
  assert.equal(weeklyMinutes(days, 60), 480 + 240 + 0);
});

test("[SCH-02] daysWorked y restDays cuentan la semana", () => {
  const days = [
    workday({ weekday: 1 }),
    workday({ weekday: 2, restDay: true }),
    workday({ weekday: 3 }),
  ];
  assert.equal(daysWorked(days), 2);
  assert.equal(restDays(days), 1);
});

test("suggestedName propone el nombre a partir de los días y las horas", () => {
  const week = (rest: number[], patch: (weekday: number) => Partial<ScheduleDayInput> = () => ({})) =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => workday({ weekday, restDay: rest.includes(weekday), ...patch(weekday) }));
  assert.equal(suggestedName(week([6, 7])), "L–V 08:00–17:00");
  assert.equal(suggestedName(week([7])), "L–S 08:00–17:00");
  assert.equal(suggestedName(week([2, 4, 6, 7])), "L M V 08:00–17:00");
  assert.equal(suggestedName(week([7], (weekday) => (weekday === 6 ? { endTime: "13:00" } : {}))), "L–S");
  assert.equal(suggestedName(week([1, 2, 3, 4, 5, 6, 7])), "");
});

test("la comida del día se descuenta en vez de los minutos del horario", () => {
  assert.equal(dayMinutes(workday(), 60), 8 * 60, "sin ventana: 9 h − 60 min");
  assert.equal(dayMinutes(workday({ mealStartTime: "14:00", mealEndTime: "14:30" }), 60), 8 * 60 + 30, "con ventana de 30 min");
  assert.equal(dayMinutes(workday({ mealStartTime: "14:00" }), 60), 8 * 60, "ventana incompleta: usa los minutos del horario");
});
