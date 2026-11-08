/**
 * Modo de checada del empleado (EMP-05) y su efecto en el marcaje remoto
 * (NOM-01/ACT-33): quien checa en reloj no puede marcar desde la web.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  createTenant,
  createUser,
  clientSession,
  expectError,
  expectStatus,
  login,
  setupSuite,
  stopSuite,
} from "./harness";

before(async () => {
  await setupSuite();
});
after(async () => {
  await stopSuite();
});

describe("modo de checada", () => {
  test("[EMP-05][NOM-01][ACT-33] CLOCK bloquea el marcaje remoto; WEB lo permite", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("CLIENT_ADMIN", { tenant });
    const employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const session = await login({ username: employee.username, tenant: tenant.slug });

    const setClock = await api("PATCH", `/hr/${employee.id}/profile`, {
      token: hr.token,
      body: { checkinMode: "CLOCK" },
    });
    expectStatus(setClock, 200, "modo CLOCK");
    assert.notEqual(setClock.body?.id, undefined);

    const blocked = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY" },
    });
    expectError(blocked, 403, "REMOTE_PUNCH_NOT_ALLOWED", "marcaje web con modo CLOCK");

    const invalid = await api("PATCH", `/hr/${employee.id}/profile`, {
      token: hr.token,
      body: { checkinMode: "TELEPATIA" },
    });
    expectStatus(invalid, 400, "modo inválido");

    // Con WEB el marcaje deja de estar bloqueado por el modo (si el cliente lo permite).
    await api("PATCH", `/hr/${employee.id}/profile`, { token: hr.token, body: { checkinMode: "WEB" } });
    const config = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { remotePunchEnabled: true, blockRemoteWithoutAgreement: true },
    });
    expectStatus(config, 200, "config de marcaje remoto");
    const web = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY", workMode: "REMOTO" },
    });
    // Con WEB ya no aplica el bloqueo por modo: el siguiente candado es el acuerdo.
    expectError(web, 403, "REMOTE_AGREEMENT_REQUIRED", "marcaje web con modo WEB");
  });
});
