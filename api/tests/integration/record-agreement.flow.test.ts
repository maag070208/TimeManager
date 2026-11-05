/** RJ-07: acuerdo de método de registro con doble firma e historial de versiones. */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
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

describe("acuerdo de método de registro", () => {
  test("propuesta, aceptación del trabajador, firma patronal e historial", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const worker = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const workerSession = await login({ username: worker.username, tenant: tenant.slug });

    const proposal = await api("GET", "/nom/me/record-agreement/proposal", {
      token: workerSession.token,
    });
    expectStatus(proposal, 200, "propuesta de acuerdo");
    const methods = proposal.body?.methods as string[];
    assert.ok(methods.includes("CLOCK"));
    assert.ok(String(proposal.body?.text).length > 50, "la propuesta trae el texto completo");

    const accepted = await api("POST", "/nom/me/record-agreement/accept", {
      token: workerSession.token,
      body: { methods, roundingPolicy: "Minutos exactos", correctionRules: "Ajuste aprobado" },
    });
    expectStatus(accepted, 200, "aceptación del trabajador");
    assert.ok(accepted.body?.acceptedHash);
    assert.equal(accepted.body?.employerAcceptedAt ?? null, null);

    const signed = await api("POST", `/nom/record-agreements/${accepted.body?.id}/employer-sign`, {
      token: hr.token,
      body: {},
    });
    expectStatus(signed, 200, "firma patronal");
    assert.ok(signed.body?.employerAcceptedAt);
    assert.ok(signed.body?.employerAcceptedHash);

    const versions = await api("GET", `/nom/record-agreements/${accepted.body?.id}/versions`, {
      token: hr.token,
    });
    expectStatus(versions, 200, "versiones del acuerdo");
    assert.ok((versions.body as unknown[]).length >= 1);
  });
});
