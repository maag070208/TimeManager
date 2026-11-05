/**
 * Desconexión del propio sistema (NOM-037 4.11/7.3 e): las notificaciones a un
 * teletrabajador fuera de su jornada se difieren a la siguiente jornada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDeliveryFromSchedule } from "./telework-deferral";

const TZ = "America/Mexico_City"; // UTC-6, sin horario de verano desde 2022.
const iso = (utc: string) => new Date(utc).toISOString();

const dayShift = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "09:00",
  endTime: "18:00",
  restDay: false,
}));
const nightShift = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "22:00",
  endTime: "06:00",
  restDay: false,
}));

test("dentro de la jornada se entrega de inmediato", () => {
  // miércoles 4-nov-2026 10:00 local
  assert.equal(nextDeliveryFromSchedule(dayShift, new Date("2026-11-04T16:00:00.000Z"), TZ), null);
});

test("antes de la jornada se difiere al inicio del día", () => {
  // miércoles 4-nov-2026 07:00 local
  assert.equal(
    nextDeliveryFromSchedule(dayShift, new Date("2026-11-04T13:00:00.000Z"), TZ)?.toISOString(),
    iso("2026-11-04T15:00:00.000Z")
  );
});

test("después de la jornada se difiere al siguiente día laboral", () => {
  // martes 3-nov-2026 21:00 local → miércoles 09:00
  assert.equal(
    nextDeliveryFromSchedule(dayShift, new Date("2026-11-04T03:00:00.000Z"), TZ)?.toISOString(),
    iso("2026-11-04T15:00:00.000Z")
  );
  // viernes 6-nov-2026 20:00 local → lunes 9-nov-2026 09:00
  assert.equal(
    nextDeliveryFromSchedule(dayShift, new Date("2026-11-07T02:00:00.000Z"), TZ)?.toISOString(),
    iso("2026-11-09T15:00:00.000Z")
  );
});

test("turno nocturno que cruza la medianoche se respeta", () => {
  // lunes 2-nov-2026 23:00 local (dentro de 22:00–06:00)
  assert.equal(nextDeliveryFromSchedule(nightShift, new Date("2026-11-03T05:00:00.000Z"), TZ), null);
  // martes 3-nov-2026 07:00 local (después del turno) → martes 22:00
  assert.equal(
    nextDeliveryFromSchedule(nightShift, new Date("2026-11-03T13:00:00.000Z"), TZ)?.toISOString(),
    iso("2026-11-04T04:00:00.000Z")
  );
});
