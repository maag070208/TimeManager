/**
 * F4-02 — cursor en el resto de `/query` (además de checadas, usuarios y acceso).
 *
 * Cubre departamentos, expediente de RH, empleados del reloj y auditoría:
 * compatibilidad con offset, `nextCursor` y no-repetición entre páginas.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createDepartment,
  createPunch,
  createTenant,
  createUser,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

let tenant: TenantFixture;
let admin: Session;

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  // 12 departamentos con nombres ordenables.
  for (let i = 0; i < 12; i += 1) {
    await createDepartment(tenant.id, `DEP-${String(i).padStart(2, "0")}`);
  }
  // 12 empleados de reloj (sin vínculo) y 12 personas de expediente.
  for (let i = 0; i < 12; i += 1) {
    await createPunch(tenant.id, {
      employeeNumber: `NUM-${String(i).padStart(2, "0")}`,
      name: `PERSONA ${String(i).padStart(2, "0")}`,
      serialNo: 5000 + i,
      occurredAt: new Date(Date.now() - i * 60_000),
    });
    await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      username: unique("exp"),
      employeeNumber: `EXP-${String(i).padStart(2, "0")}`,
    });
  }
  // 12 registros de auditoría del cliente.
  const { prismaClient } = await import("@core/config/database");
  const { runWithTenant } = await import("@core/tenancy");
  for (let i = 0; i < 12; i += 1) {
    await runWithTenant(tenant.id, () =>
      prismaClient.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: "TEST_CURSOR",
          entityType: "Test",
          entityId: `entity-${i}`,
          userName: "prueba",
        },
      })
    );
  }
});

after(async () => {
  await stopSuite();
});

const pageOne = (path: string, token: string) =>
  api("POST", path, { token, body: { page: 1, limit: 5 } });

const byCursor = (path: string, token: string, cursor: unknown) =>
  api("POST", path, { token, body: { cursor, limit: 5 } });

const idsOf = (body: unknown, field = "id"): string[] =>
  ((body as { data?: Array<Record<string, unknown>> })?.data ?? []).map((row) => String(row[field]));

describe("cursor en el resto de /query", () => {
  test("departamentos: nextCursor y pagina 2 sin repetir", async () => {
    const first = await pageOne("/departments/query", admin.token);
    expectStatus(first, 200, "departamentos p1");
    const firstIds = idsOf(first.body);
    assert.equal(firstIds.length, 5);
    assert.equal(typeof first.body?.nextCursor, "string");

    const second = await byCursor("/departments/query", admin.token, first.body?.nextCursor);
    expectStatus(second, 200, "departamentos p2");
    const secondIds = idsOf(second.body);
    assert.ok(secondIds.length > 0);
    assert.equal(secondIds.some((id) => firstIds.includes(id)), false);
  });

  test("expediente de RH: nextCursor y pagina 2 sin repetir", async () => {
    const first = await pageOne("/hr/query", admin.token);
    expectStatus(first, 200, "expediente p1");
    const firstIds = idsOf(first.body);
    assert.equal(firstIds.length, 5);
    assert.equal(typeof first.body?.nextCursor, "string");

    const second = await byCursor("/hr/query", admin.token, first.body?.nextCursor);
    expectStatus(second, 200, "expediente p2");
    const secondIds = idsOf(second.body);
    assert.equal(secondIds.some((id) => firstIds.includes(id)), false);
  });

  test("empleados del reloj: nextCursor y pagina 2 sin repetir", async () => {
    const first = await pageOne("/time-clock/employees/query", admin.token);
    expectStatus(first, 200, "empleados p1");
    const firstNumbers = idsOf(first.body, "employeeNumber");
    assert.equal(firstNumbers.length, 5);
    assert.equal(typeof first.body?.nextCursor, "string");

    const second = await byCursor("/time-clock/employees/query", admin.token, first.body?.nextCursor);
    expectStatus(second, 200, "empleados p2");
    const secondNumbers = idsOf(second.body, "employeeNumber");
    assert.ok(secondNumbers.length > 0);
    assert.equal(secondNumbers.some((number) => firstNumbers.includes(number)), false);
  });

  test("auditoría (GET /audit): nextCursor y pagina 2 sin repetir", async () => {
    const first = await api("GET", "/audit?page=1&limit=5", { token: admin.token });
    expectStatus(first, 200, "auditoría p1");
    const firstIds = idsOf(first.body);
    assert.equal(firstIds.length, 5);
    assert.equal(typeof first.body?.nextCursor, "string");

    const second = await api("GET", `/audit?limit=5&cursor=${encodeURIComponent(String(first.body?.nextCursor))}`, {
      token: admin.token,
    });
    expectStatus(second, 200, "auditoría p2");
    const secondIds = idsOf(second.body);
    assert.ok(secondIds.length > 0);
    assert.equal(secondIds.some((id) => firstIds.includes(id)), false);
  });

  test("un cursor corrupto cae a offset sin romper", async () => {
    const response = await api("POST", "/departments/query", {
      token: admin.token,
      body: { page: 1, limit: 5, cursor: "%%no-es-cursor%%" },
    });
    expectStatus(response, 200, "cursor corrupto");
    assert.equal(idsOf(response.body).length, 5);
  });
});
