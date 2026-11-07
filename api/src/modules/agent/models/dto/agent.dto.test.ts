/** DTOs del agente local (AGT-01/ACT-36): validan payloads antes de tocar BD. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AgentHeartbeatBodySchema,
  AgentJobResultBodySchema,
  AgentPunchesBodySchema,
  AgentRegisterBodySchema,
} from "./agent.dto";
import { AgentEnqueueJobBodySchema } from "./agent-console.dto";

const punch = {
  serialNo: 10,
  employeeNumber: "1001",
  name: "Ana",
  minor: 75,
  occurredAt: "2026-11-06T15:00:00.000Z",
};

test("[AGT-01][ACT-36] valida el lote de checadas del agente", () => {
  const ok = AgentPunchesBodySchema.safeParse({
    clockSerial: "CLOCK-1",
    punches: [punch],
    lastSerialNo: 10,
  });
  assert.equal(ok.success, true);

  const empty = AgentPunchesBodySchema.safeParse({ clockSerial: "CLOCK-1", punches: [] });
  assert.equal(empty.success, false, "un lote vacío no es válido");

  const badMinor = AgentPunchesBodySchema.safeParse({
    clockSerial: "CLOCK-1",
    punches: [{ ...punch, minor: 9999 }],
  });
  assert.equal(badMinor.success, false);

  const badDate = AgentPunchesBodySchema.safeParse({
    clockSerial: "CLOCK-1",
    punches: [{ ...punch, occurredAt: "ayer" }],
  });
  assert.equal(badDate.success, false, "exige ISO con offset");

  const tooMany = AgentPunchesBodySchema.safeParse({
    clockSerial: "CLOCK-1",
    punches: Array.from({ length: 501 }, (_, i) => ({ ...punch, serialNo: i + 1 })),
  });
  assert.equal(tooMany.success, false, "tope de 500 por lote");
});

test("[AGT-M01][AGT-01] registro, resultado de trabajo y heartbeat", () => {
  assert.equal(AgentRegisterBodySchema.safeParse({ name: "PC recepción", version: "1.0" }).success, true);
  assert.equal(AgentRegisterBodySchema.safeParse({ name: "x".repeat(121) }).success, false);

  assert.equal(AgentJobResultBodySchema.safeParse({ ok: true, result: { count: 2 } }).success, true);
  assert.equal(AgentJobResultBodySchema.safeParse({ ok: false, error: "timeout" }).success, true);
  assert.equal(AgentJobResultBodySchema.safeParse({ ok: false, error: "x".repeat(2001) }).success, false);

  assert.equal(
    AgentHeartbeatBodySchema.safeParse({
      version: "1.0",
      lastSyncAt: "2026-11-06T15:00:00.000Z",
      pendingPunches: 3,
      clocks: [{ serialNumber: "CLOCK-1", ok: true }],
    }).success,
    true
  );
  assert.equal(AgentHeartbeatBodySchema.safeParse({ pendingPunches: -1 }).success, false);
});

test("[AGT-01][ACT-36] encolar trabajo: cada acción exige su payload", () => {
  const sync = AgentEnqueueJobBodySchema.safeParse({ clockSerial: "CLOCK-1", type: "SYNC" });
  assert.equal(sync.success, true);
  const personAdd = AgentEnqueueJobBodySchema.safeParse({
    clockSerial: "CLOCK-1",
    type: "PERSON_ADD",
    payload: { employeeNumber: "1001", name: "Ana" },
  });
  assert.equal(personAdd.success, true);
  const missingPayload = AgentEnqueueJobBodySchema.safeParse({ clockSerial: "CLOCK-1", type: "PERSON_ADD" });
  assert.equal(missingPayload.success, false, "PERSON_ADD sin persona no es válido");
  const badAction = AgentEnqueueJobBodySchema.safeParse({ clockSerial: "CLOCK-1", type: "NOPE" });
  assert.equal(badAction.success, false);
});
