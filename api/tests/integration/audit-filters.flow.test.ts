/**
 * Bitácora de auditoría (AUD-01): filtros, detalle y aislamiento por cliente.
 * La lista está scopeada: plataforma con `X-Tenant-Id` ve ese cliente; un
 * usuario de cliente sólo puede ver los logs de su propio cliente (o 403).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
} from "./harness";

before(async () => {
  await setupSuite();
});
after(async () => {
  await stopSuite();
});

describe("auditoría", () => {
  test("[AUD-01][AUD-M1] filtra por cliente, acción, entidad, persona y fechas", async () => {
    const { prismaClient } = await import("@core/config/database");
    const platform = await platformSession("ADMIN");
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const actor = await platformSession("ADMIN");

    const base = { entityType: "QaAudit", entityId: "entity-1" };
    const logA = await prismaClient.auditLog.create({
      data: {
        tenantId: tenantA.id,
        action: "QA_ACTION_A",
        module: "qa",
        ...base,
        userId: actor.user.id,
        userName: "auditor",
      },
    });
    const logB = await prismaClient.auditLog.create({
      data: { tenantId: tenantB.id, action: "QA_ACTION_B", module: "qa", entityType: "QaAudit", entityId: "entity-2" },
    });
    assert.ok(logA.id && logB.id);

    const byTenant = await api("GET", `/audit?tenantId=${tenantA.id}&action=QA_ACTION_A`, {
      token: platform.token,
    });
    expectStatus(byTenant, 200, "filtro por cliente y acción");
    const rows = byTenant.body as { data: Array<{ id: string; tenantId?: string }> };
    assert.deepEqual(rows.data.map((r) => r.id), [logA.id]);
    assert.equal(rows.data.some((r) => r.id === logB.id), false, "no mezcla otro cliente");

    const byEntity = await api("GET", `/audit?entityType=QaAudit&entityId=entity-2`, {
      token: platform.token,
    });
    expectStatus(byEntity, 200, "filtro por entidad");
    assert.ok((byEntity.body as { data: Array<{ id: string }> }).data.some((r) => r.id === logB.id));

    const byUser = await api("GET", `/audit?userId=${actor.user.id}`, { token: platform.token });
    expectStatus(byUser, 200, "filtro por persona");
    assert.ok((byUser.body as { data: Array<{ id: string }> }).data.some((r) => r.id === logA.id));

    const byRange = await api(
      "GET",
      `/audit?start=${new Date(Date.now() - 3600_000).toISOString()}&end=${new Date(Date.now() + 3600_000).toISOString()}`,
      { token: platform.token }
    );
    expectStatus(byRange, 200, "filtro por fechas");

    const detail = await api("GET", `/audit/${logA.id}`, { token: platform.token });
    expectStatus(detail, 200, "detalle de bitácora");
    assert.equal(detail.body?.action, "QA_ACTION_A");
  });

  test("[AUD-01] un usuario de cliente no entra a la bitácora de plataforma", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    const forbidden = await api("GET", "/audit", { token: staff.token });
    expectError(forbidden, 403, "INSUFFICIENT_PERMISSIONS", "bitácora sin permiso");
  });

  test("[AUD-01] el cliente administrador sólo ve su propia bitácora", async () => {
    const { prismaClient } = await import("@core/config/database");
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const adminA = await clientSession("CLIENT_ADMIN", { tenant: tenantA });
    const logA = await prismaClient.auditLog.create({
      data: { tenantId: tenantA.id, action: "QA_SCOPED_A", module: "qa", entityType: "QaScoped", entityId: "a" },
    });
    const logB = await prismaClient.auditLog.create({
      data: { tenantId: tenantB.id, action: "QA_SCOPED_B", module: "qa", entityType: "QaScoped", entityId: "b" },
    });

    const own = await api("GET", "/audit?entityType=QaScoped", { token: adminA.token });
    expectStatus(own, 200, "bitácora del cliente");
    const ids = (own.body as { data: Array<{ id: string }> }).data.map((r) => r.id);
    assert.ok(ids.includes(logA.id));
    assert.equal(ids.includes(logB.id), false, "no ve la bitácora de otro cliente");

    // Aunque pida explícitamente otro cliente, manda el scope de su sesión.
    const forced = await api("GET", `/audit?tenantId=${tenantB.id}&entityType=QaScoped`, { token: adminA.token });
    expectStatus(forced, 200, "filtro por otro cliente");
    assert.equal((forced.body as { data: Array<{ id: string }> }).data.some((r) => r.id === logB.id), false);
  });
});
