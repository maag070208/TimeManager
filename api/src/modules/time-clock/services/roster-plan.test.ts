/** Reglas puras del padrón del reloj (CLK-03/ACT-30): lecturas, sospecha y bajas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planRoster,
  ROSTER_DROP_RATIO,
  ROSTER_GRACE_MS,
  ROSTER_GRACE_RUNS,
  type RosterReading,
} from "./roster-plan";

const now = new Date("2026-11-06T12:00:00.000Z");
const reading = (overrides: Partial<RosterReading> = {}): RosterReading => ({
  clockSerial: "CLOCK-1",
  ok: true,
  numbers: ["1001", "1002"],
  previousNumbers: ["1001", "1002"],
  ...overrides,
});

const link = (overrides: Record<string, unknown> = {}) => ({
  employeeNumber: "1001",
  userActive: true,
  status: "ACTIVE" as const,
  missingRuns: 0,
  missingSince: null as Date | null,
  reappearedAt: null as Date | null,
  ...overrides,
});

test("[CLK-03][ACT-30] sin lecturas válidas no hay corrida ni cambios", () => {
  const plan = planRoster({ now, readings: [reading({ ok: false })], links: [link()] });
  assert.equal(plan.noRun, true);
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.newNumbers.length, 0);
});

test("[CLK-03][ACT-30] una caída sospechosa bloquea las bajas pero conserva el padrón previo", () => {
  const dropped = reading({
    numbers: ["1001"],
    previousNumbers: ["1001", "1002", "1003", "1004"],
  });
  assert.ok(dropped.previousNumbers.length - dropped.numbers.length > dropped.previousNumbers.length * ROSTER_DROP_RATIO);
  const plan = planRoster({ now, readings: [dropped], links: [link({ employeeNumber: "1002" })] });
  assert.equal(plan.noRun, true, "la lectura no se confía");
  assert.equal(plan.suspicious, true);
  assert.equal(plan.changes.length, 0);
});

test("[CLK-03][ACT-30] ausencias con gracia pasan a baja pendiente y reaparecer la cancela", () => {
  const absentSince = new Date(now.getTime() - ROSTER_GRACE_MS - 1000);
  // Un vínculo ausente fuera del set presente con gracia cumplida → PENDING_REMOVAL.
  const plan = planRoster({
    now,
    readings: [reading({ numbers: ["1002"], previousNumbers: ["1002"] })],
    links: [{ ...link(), missingRuns: ROSTER_GRACE_RUNS - 1, missingSince: absentSince }],
  });
  assert.equal(plan.noRun, false);
  const change = plan.changes.find((c) => c.employeeNumber === "1001");
  assert.ok(change, "hay cambio para la persona ausente");
  assert.equal(change?.status, "PENDING_REMOVAL");
  assert.equal(change?.event, "REMOVAL_PENDING");

  // Reaparece: se activa y cancela la baja pendiente.
  const back = planRoster({
    now,
    readings: [reading()],
    links: [{ ...link(), status: "PENDING_REMOVAL", missingRuns: ROSTER_GRACE_RUNS }],
  });
  const cancelled = back.changes.find((c) => c.employeeNumber === "1001");
  assert.equal(cancelled?.status, "ACTIVE");
  assert.equal(cancelled?.event, "REMOVAL_CANCELLED");
});

test("[CLK-03][ACT-30] números nuevos sin vínculo y reloj inválido conserva lo previo", () => {
  const plan = planRoster({
    now,
    readings: [
      reading({ numbers: ["1001", "2000"], previousNumbers: ["1001"] }),
      reading({ clockSerial: "CLOCK-2", ok: false, numbers: [], previousNumbers: ["3000"] }),
    ],
    links: [link()],
  });
  assert.deepEqual(plan.newNumbers, ["2000", "3000"], "lo no leído de un reloj inválido se conserva");
  assert.deepEqual(plan.replaceClocks, ["CLOCK-1"], "solo reemplaza el reloj confiable");
  assert.equal(plan.added, 1);
});
