/** Kardex de pagos por cliente (plataforma). */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  createTenant,
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

describe("kardex de pagos del cliente", () => {
  test("registra cargo, consulta kardex y marca pagado", async () => {
    const tenant = await createTenant();
    const platform = await platformSession("ADMIN");

    const created = await api("POST", `/tenants/${tenant.id}/payments`, {
      token: platform.token,
      body: {
        concept: "Suscripción mensual",
        period: "2026-11",
        amount: 500,
        dueDate: "2026-11-05",
      },
    });
    expectStatus(created, 201, "cargo creado");
    assert.equal(created.body?.status, "PENDING");

    const kardex = await api("GET", `/tenants/${tenant.id}/payments`, { token: platform.token });
    expectStatus(kardex, 200, "kardex");
    assert.equal(kardex.body?.rows?.length, 1);
    assert.equal(kardex.body?.summary?.pending, 500);

    const paid = await api("PATCH", `/tenants/${tenant.id}/payments/${created.body?.id}`, {
      token: platform.token,
      body: { status: "PAID", paidAt: "2026-11-05T12:00:00.000Z" },
    });
    expectStatus(paid, 200, "pago registrado");
    assert.equal(paid.body?.status, "PAID");

    const updated = await api("GET", `/tenants/${tenant.id}/payments`, { token: platform.token });
    assert.equal(updated.body?.summary?.paid, 500);
    assert.equal(updated.body?.summary?.pending, 0);
  });
});
