import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { PunchAdjustmentsService } from "./punch-adjustments.service";

const NOW = new Date("2026-11-17T23:00:00.000Z");

type Row = Record<string, unknown>;

const fakeDb = (state: { adjustments: Row[]; punches: Row[] }) => {
  const db = {
    user: { findUnique: async () => ({ id: "u1", name: "Karla", employeeNumber: "7", tenantId: null }) },
    timeClockEmployee: { findMany: async () => [] },
    teleworkRegistration: { findFirst: async () => null },
    punchAdjustment: {
      findMany: async ({ where }: { where: Row }) =>
        state.adjustments.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value)),
      findUnique: async ({ where }: { where: { id: string } }) => state.adjustments.find((row) => row.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = state.adjustments.find((item) => item.id === where.id);
        return { ...row, requestedBy: { name: "Karla" }, decidedBy: null };
      },
      create: async ({ data }: { data: Row }) => {
        const row = { id: `a${state.adjustments.length + 1}`, status: "PENDING", createdAt: NOW, punchId: null, remotePunchId: null, decidedById: null, decidedAt: null, decisionNote: null, ...data };
        state.adjustments.push(row);
        return { ...row, requestedBy: { name: "Karla" }, decidedBy: null };
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const row = state.adjustments.find((item) => item.id === where.id && item.status === where.status);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = state.adjustments.find((item) => item.id === where.id)!;
        return Object.assign(row, data);
      },
    },
    remotePunch: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `p${state.punches.length + 1}`, workMode: "REMOTO", ...data };
        state.punches.push(row);
        return row;
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return db as unknown as PrismaClient;
};

test("checada olvidada queda pendiente sin tocar marcajes", async () => {
  const state = { adjustments: [] as Row[], punches: [] as Row[] };
  const dto = await new PunchAdjustmentsService(fakeDb(state)).reportMissingPunch(
    "u1",
    { type: "EXIT", occurredAt: "2026-11-17T00:30:00.000Z", reason: "Olvidé checar la salida" },
    NOW
  );
  assert.equal(dto.targetType, "MISSING");
  assert.equal(dto.punchId, null);
  assert.deepEqual(dto.newState, { type: "EXIT", occurredAt: "2026-11-17T00:30:00.000Z" });
  assert.equal(state.punches.length, 0);
});

test("checada olvidada rechaza fechas futuras o muy viejas", async () => {
  const service = new PunchAdjustmentsService(fakeDb({ adjustments: [], punches: [] }));
  for (const occurredAt of ["2026-11-18T01:00:00.000Z", "2026-10-01T15:00:00.000Z"]) {
    await assert.rejects(
      service.reportMissingPunch("u1", { type: "ENTRY", occurredAt, reason: "Se me olvidó" }, NOW),
      (error: { code?: string; message?: string }) => (error.code ?? error.message) === "MISSING_PUNCH_OUT_OF_RANGE"
    );
  }
});

test("no se pide dos veces la misma checada del mismo día", async () => {
  const state = { adjustments: [] as Row[], punches: [] as Row[] };
  const service = new PunchAdjustmentsService(fakeDb(state));
  await service.reportMissingPunch("u1", { type: "ENTRY", occurredAt: "2026-11-17T15:00:00.000Z", reason: "Se me olvidó" }, NOW);
  await assert.rejects(
    service.reportMissingPunch("u1", { type: "ENTRY", occurredAt: "2026-11-17T15:10:00.000Z", reason: "Otra vez" }, NOW),
    (error: { code?: string; message?: string }) => (error.code ?? error.message) === "MISSING_PUNCH_ALREADY_REQUESTED"
  );
});

test("aprobar una checada olvidada crea el marcaje y lo enlaza", async () => {
  const state = { adjustments: [] as Row[], punches: [] as Row[] };
  const service = new PunchAdjustmentsService(fakeDb(state));
  const { id } = await service.reportMissingPunch("u1", { type: "EXIT", occurredAt: "2026-11-17T00:30:00.000Z", reason: "Olvidé la salida" }, NOW);
  const dto = await service.decide(id, "APPROVE", undefined, { id: "rh1", name: "RH" });

  assert.equal(state.punches.length, 1);
  const [punch] = state.punches;
  assert.equal(punch.userId, "u1");
  assert.equal(punch.type, "EXIT");
  assert.equal((punch.occurredAt as Date).toISOString(), "2026-11-17T00:30:00.000Z");
  assert.equal(punch.clientEventId, `adjustment:${id}`);
  assert.equal(dto.status, "APPROVED");
  assert.equal(dto.punchId, punch.id);
});

test("rechazar una checada olvidada no crea marcaje", async () => {
  const state = { adjustments: [] as Row[], punches: [] as Row[] };
  const service = new PunchAdjustmentsService(fakeDb(state));
  const { id } = await service.reportMissingPunch("u1", { type: "ENTRY", occurredAt: "2026-11-17T15:00:00.000Z", reason: "Se me olvidó" }, NOW);
  await service.decide(id, "REJECT", "No estuviste", { id: "rh1", name: "RH" });
  assert.equal(state.punches.length, 0);
});
