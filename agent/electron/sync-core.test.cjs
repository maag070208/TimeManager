"use strict";

/**
 * Pruebas del núcleo de sincronización del agente (sin Electron, ISAPI ni red):
 *   pnpm --filter timemanager-agent test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clampChunkSeconds,
  chunkDue,
  planWindows,
  toPunch,
  mergePunches,
  takeBatch,
  removeUploaded,
  nextCursor,
  retryDelayMs,
  summarizeQueue,
  punchMethod,
  pollDue,
  heartbeatDue,
} = require("./sync-core.cjs");

test("clampChunkSeconds respeta el rango 15–30 s de la decisión A1", () => {
  assert.equal(clampChunkSeconds(20), 20);
  assert.equal(clampChunkSeconds(1), 15);
  assert.equal(clampChunkSeconds(90), 30);
  assert.equal(clampChunkSeconds("abc"), 20, "valor inválido cae al default");
  assert.equal(clampChunkSeconds(20.6), 21);
});

test("chunkDue dispara al cumplirse el intervalo", () => {
  const now = 1_000_000;
  assert.equal(chunkDue(null, now, 20), true, "sin corrida previa");
  assert.equal(chunkDue(now - 5_000, now, 20), false);
  assert.equal(chunkDue(now - 20_000, now, 20), true);
});

test("planWindows cubre el rango sin traslapes ni huecos", () => {
  assert.deepEqual(planWindows(0, 0), []);
  assert.deepEqual(planWindows(0, 3), [{ from: 1, to: 3 }]);
  assert.deepEqual(planWindows(10, 10), []);
  assert.deepEqual(planWindows(10, 25, 5), [
    { from: 11, to: 15 },
    { from: 16, to: 20 },
    { from: 21, to: 25 },
  ]);
});

test("toPunch normaliza el evento ISAPI y descarta lo que no es checada", () => {
  const punch = toPunch(
    { serialNo: 42, employeeNoString: "070562", name: " Ana ", minor: 75, time: "2026-11-05T15:00:00-07:00" },
    "CLK-1"
  );
  assert.deepEqual(punch, {
    clockSerial: "CLK-1",
    serialNo: 42,
    employeeNumber: "070562",
    name: "Ana",
    minor: 75,
    occurredAt: "2026-11-05T22:00:00.000Z",
  });
  assert.equal(punchMethod(75), "FACE");
  assert.equal(punchMethod(38), "FINGERPRINT");
  assert.equal(punchMethod(1), "CARD");
  assert.equal(punchMethod(999), "OTHER");

  assert.equal(toPunch({ serialNo: 0, employeeNoString: "1", time: "2026-11-05T15:00:00Z" }, "CLK"), null);
  assert.equal(toPunch({ serialNo: 5, employeeNoString: "", time: "2026-11-05T15:00:00Z" }, "CLK"), null);
  assert.equal(toPunch({ serialNo: 5, employeeNoString: "1", time: "no-es-fecha" }, "CLK"), null);
});

test("mergePunches deduplica la cola por reloj+consecutivo", () => {
  const existing = [
    { clockSerial: "A", serialNo: 2, employeeNumber: "1" },
    { clockSerial: "A", serialNo: 1, employeeNumber: "1" },
  ];
  const incoming = [
    { clockSerial: "A", serialNo: 2, employeeNumber: "1" },
    { clockSerial: "A", serialNo: 3, employeeNumber: "1" },
    { clockSerial: "B", serialNo: 1, employeeNumber: "2" },
  ];
  const result = mergePunches(existing, incoming);
  assert.equal(result.queue.length, 4);
  assert.equal(result.added, 2, "solo 3 y B:1 son nuevas");
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.queue.map((p) => `${p.clockSerial}:${p.serialNo}`), ["A:1", "B:1", "A:2", "A:3"]);
});

test("takeBatch y removeUploaded respetan el tope por request", () => {
  const queue = Array.from({ length: 450 }, (_, i) => ({ clockSerial: "A", serialNo: i + 1 }));
  const { batch, rest } = takeBatch(queue, 200);
  assert.equal(batch.length, 200);
  assert.equal(rest.length, 250);
  assert.equal(batch[0].serialNo, 1);
  assert.equal(rest[0].serialNo, 201);

  const uploaded = batch.slice(0, 100);
  const remaining = removeUploaded(queue, uploaded);
  assert.equal(remaining.length, 350);
  assert.equal(remaining[0].serialNo, 101, "la cola conserva lo no confirmado");
});

test("nextCursor es monótono incluso con reenvíos viejos", () => {
  assert.equal(nextCursor(100, 0, []), 100);
  assert.equal(nextCursor(100, 150, []), 150);
  assert.equal(nextCursor(100, 0, [{ serialNo: 99 }]), 100, "un chunk viejo no retrocede el cursor");
  assert.equal(nextCursor(100, 160, [{ serialNo: 150 }, { serialNo: 155 }]), 160);
});

test("retryDelayMs crece y tiene tope", () => {
  assert.equal(retryDelayMs(1), 5000);
  assert.equal(retryDelayMs(2), 10000);
  assert.equal(retryDelayMs(4), 40000);
  assert.equal(retryDelayMs(20), 300000);
});

test("pollDue y heartbeatDue usan sus intervalos", () => {
  const now = 1_000_000;
  assert.equal(pollDue(null, now, 5), true);
  assert.equal(pollDue(now - 4_000, now, 5), false);
  assert.equal(pollDue(now - 5_000, now, 5), true);
  assert.equal(heartbeatDue(now - 29_000, now, 30), false);
  assert.equal(heartbeatDue(now - 30_000, now, 30), true);
});

test("summarizeQueue cuenta pendientes por reloj", () => {
  const summary = summarizeQueue([
    { clockSerial: "A", serialNo: 5 },
    { clockSerial: "A", serialNo: 7 },
    { clockSerial: "B", serialNo: 1 },
  ]);
  assert.deepEqual(summary, {
    total: 3,
    byClock: { A: 2, B: 1 },
    oldestSerialNo: 1,
    newestSerialNo: 7,
  });
  assert.deepEqual(summarizeQueue([]), { total: 0, byClock: {}, oldestSerialNo: null, newestSerialNo: null });
});
