import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { EmployeeOverviewService } from "./employee-overview.service";

const fakeDb = (calls: Record<string, unknown[]>) =>
  ({
    user: { findUnique: async () => ({ id: "u1", employeeNumber: "7" }) },
    timeClockEmployee: { findFirst: async () => null },
    timeClockPunch: {
      findMany: async (args: unknown) => {
        calls.clock.push(args);
        return [
          { id: "c1", occurredAt: new Date("2026-11-17T14:00:00.000Z"), method: "FINGERPRINT", clockSerial: "S1", createdAt: new Date("2026-11-17T14:01:00.000Z"), adjustments: [] },
        ];
      },
    },
    remotePunch: {
      findMany: async (args: unknown) => {
        calls.remote.push(args);
        return [
          {
            id: "r1",
            type: "EXIT",
            source: "WEB",
            workMode: "REMOTO",
            occurredAt: new Date("2026-11-17T23:00:00.000Z"),
            clientReportedAt: new Date("2026-11-17T22:57:00.000Z"),
            location: null,
            latitude: 19.4,
            longitude: -99.1,
            gpsAccuracyMeters: 12,
            note: null,
            createdAt: new Date("2026-11-17T23:00:01.000Z"),
            adjustments: [
              { id: "a1", status: "PENDING", reason: "Salí antes", newState: { occurredAt: "2026-11-17T22:30:00.000Z" }, decisionNote: null, createdAt: new Date("2026-11-18T01:00:00.000Z"), decidedAt: null },
            ],
          },
        ];
      },
    },
    timeClock: { findMany: async () => [{ serialNumber: "S1", name: "Entrada principal" }] },
  }) as unknown as PrismaClient;

test("historial mezcla reloj y web con detalle, lo más nuevo primero", async () => {
  const calls = { clock: [] as unknown[], remote: [] as unknown[] };
  const res = await new EmployeeOverviewService(fakeDb(calls)).punchHistory("u1", { from: "2026-11-17", to: "2026-11-17" });

  assert.deepEqual(res.range, { from: "2026-11-17", to: "2026-11-17", timezone: "America/Mexico_City" });
  assert.deepEqual(res.punches.map((p) => p.id), ["r1", "c1"]);
  const [web, clock] = res.punches;
  assert.equal(web.type, "EXIT");
  assert.deepEqual(web.location, { latitude: 19.4, longitude: -99.1, gpsAccuracyMeters: 12 });
  assert.equal(web.clientReportedAt, "2026-11-17T22:57:00.000Z");
  assert.deepEqual(web.adjustments[0], {
    id: "a1",
    status: "PENDING",
    reason: "Salí antes",
    proposedAt: "2026-11-17T22:30:00.000Z",
    decisionNote: null,
    createdAt: "2026-11-18T01:00:00.000Z",
    decidedAt: null,
  });
  assert.equal(clock.clock, "Entrada principal");
  assert.equal(clock.method, "FINGERPRINT");
  const where = (calls.remote[0] as { where: { occurredAt: { gte: Date; lt: Date } } }).where.occurredAt;
  assert.equal(where.gte.toISOString(), "2026-11-17T06:00:00.000Z");
  assert.equal(where.lt.toISOString(), "2026-11-18T06:00:00.000Z");
});

test("historial rechaza rangos invertidos o de más de 92 días", async () => {
  const service = new EmployeeOverviewService(fakeDb({ clock: [], remote: [] }));
  await assert.rejects(() => service.punchHistory("u1", { from: "2026-11-18", to: "2026-11-17" }), (e: { code?: string }) => e.code === "INVALID_RANGE");
  await assert.rejects(() => service.punchHistory("u1", { from: "2026-01-01", to: "2026-11-17" }), (e: { code?: string }) => e.code === "PUNCH_HISTORY_RANGE_TOO_LONG");
});
