/** RJ-05: el archivado no se rompe con checadas ajustadas y mueve el ajuste. */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
  expectStatus,
  setupSuite,
  stopSuite,
} from "./harness";

const getDb = async () => (await import("@core/config/database")).prismaClient;

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("retención con ajustes", () => {
  test("archiva checada y ajuste sin romper la FK, y registra la corrida", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: `RET-${Date.now()}`,
    });
    const client = await getDb();
    const old = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const punch = await client.timeClockPunch.create({
      data: {
        tenantId: tenant.id,
        clockSerial: "RET-CLOCK",
        serialNo: Math.floor(Math.random() * 1_000_000),
        employeeNumber: employee.id,
        name: "Retención Ajuste",
        method: "FACE",
        minor: 75,
        occurredAt: old,
      },
    });
    await client.punchAdjustment.create({
      data: {
        tenantId: tenant.id,
        targetType: "CLOCK",
        targetId: punch.id,
        punchId: punch.id,
        requestedById: employee.id,
        reason: "La hora correcta era otra",
        previousState: { occurredAt: old.toISOString() },
        newState: { occurredAt: new Date(old.getTime() + 3600_000).toISOString() },
        status: "APPROVED",
        decidedById: hr.user.id,
        decidedAt: new Date(),
      },
    });
    await api("PUT", "/nom/config", { token: hr.token, body: { retentionMonths: 1 } });

    const dryRun = await api("POST", "/nom/retention/archive", {
      token: hr.token,
      body: { dryRun: true },
    });
    expectStatus(dryRun, 200, "archivado simulado");
    assert.equal(dryRun.body?.punches, 1);
    assert.equal(dryRun.body?.adjustments, 1, "cuenta el ajuste que se archivará");

    const real = await api("POST", "/nom/retention/archive", {
      token: hr.token,
      body: {},
    });
    expectStatus(real, 200, "archivado real");
    assert.equal(real.body?.punches, 1);
    assert.equal(real.body?.adjustments, 1);

    const archived = await client.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "nom_archived_punch_adjustments" WHERE "tenantId" = $1`,
      tenant.id
    );
    assert.equal(Number(archived[0].count), 1);
    const remaining = await client.punchAdjustment.count({
      where: { tenantId: tenant.id, targetId: punch.id },
    });
    assert.equal(remaining, 0);
  });
});
