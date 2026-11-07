/**
 * Insignia de estado de un reloj (CLK-09 Relojes checadores): prioridad de los
 * estados que ve el usuario en la tarjeta del reloj.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clockStatus } from "./status.ts";
import type { TimeClockDevice } from "./types.ts";

const clock = (overrides: Partial<TimeClockDevice>): TimeClockDevice =>
  ({
    clockSerial: "CLK-1",
    name: "Entrada",
    url: "http://127.0.0.1:4801",
    countsAttendance: true,
    writeEnabled: false,
    model: null,
    lastSerialNo: 0,
    syncedAt: null,
    punches: 0,
    lastPunch: null,
    inProgress: null,
    lastRun: null,
    pausedByCredentials: false,
    ...overrides,
  }) as TimeClockDevice;

test("[CLK-09] credenciales rechazadas mandan sobre cualquier otro estado", () => {
  assert.equal(clockStatus(clock({ pausedByCredentials: true, inProgress: {} as never })), "paused");
});

test("[CLK-09] una sincronización en curso se muestra como running", () => {
  assert.equal(clockStatus(clock({ inProgress: { readCount: 3, newCount: 0 } as never })), "running");
});

test("[CLK-09] la última corrida fallida se muestra como error", () => {
  const lastRun = { ok: false, error: "timeout" } as TimeClockDevice["lastRun"];
  assert.equal(clockStatus(clock({ lastRun })), "error");
});

test("[CLK-09] un reloj ya sincronizado está ok y uno nuevo queda pendiente", () => {
  assert.equal(clockStatus(clock({ syncedAt: "2026-11-05T10:00:00.000Z" })), "ok");
  assert.equal(clockStatus(clock({})), "pending");
});
