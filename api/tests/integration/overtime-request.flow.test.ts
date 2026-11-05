/**
 * F3/1.5 — Autorización previa y consentimiento del trabajador para horas extra.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
  type Session,
  type TenantFixture,
} from "./harness";

let tenant: TenantFixture;
let admin: Session;
let staff: Session;

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  staff = await clientSession("CLIENT_STAFF", { tenant });
});

after(async () => {
  await stopSuite();
});

const createRequest = (body: Record<string, unknown>, token = admin.token) =>
  api("POST", "/nom/overtime/requests", {
    token,
    body: { userId: staff.user.id, reason: "Cobertura de turno extraordinario", plannedMin: 120, ...body },
  });

describe("F3 autorización y consentimiento de horas extra", () => {
  test("el patrón solicita, el trabajador acepta y la solicitud queda auditada", async () => {
    const created = await createRequest({ days: ["2027-03-08"] });
    expectStatus(created, 201, "solicitud de horas extra");
    assert.equal(created.body?.status, "PENDING");

    const mine = await api("GET", "/nom/me/overtime-requests", { token: staff.token });
    expectStatus(mine, 200, "solicitudes del trabajador");
    assert.equal((mine.body as unknown[]).length, 1);

    const accepted = await api("POST", `/nom/me/overtime-requests/${created.body?.id}/decision`, {
      token: staff.token,
      body: { accept: true },
    });
    expectStatus(accepted, 200, "trabajador acepta");
    assert.equal(accepted.body?.status, "ACCEPTED");
    assert.ok(accepted.body?.workerDecidedAt);

    const again = await api("POST", `/nom/me/overtime-requests/${created.body?.id}/decision`, {
      token: staff.token,
      body: { accept: false },
    });
    expectError(again, 409, "OVERTIME_REQUEST_ALREADY_DECIDED", "decidir dos veces");
  });

  test("el trabajador puede rechazar y el rechazo no borra el registro", async () => {
    const created = await createRequest({ plannedMin: 60, days: ["2027-03-09"] });
    expectStatus(created, 201, "segunda solicitud");

    const rejected = await api("POST", `/nom/me/overtime-requests/${created.body?.id}/decision`, {
      token: staff.token,
      body: { accept: false, note: "No puedo quedarme ese día" },
    });
    expectStatus(rejected, 200, "trabajador rechaza");
    assert.equal(rejected.body?.status, "REJECTED");
    assert.equal(rejected.body?.workerNote, "No puedo quedarme ese día");

    const listed = await api("GET", "/nom/overtime/requests", { token: admin.token });
    expectStatus(listed, 200, "RH lista solicitudes");
    assert.ok((listed.body as unknown[]).length >= 2);
  });

  test("menores de 18 no pueden recibir solicitudes y el trabajador no puede crearlas", async () => {
    const minor = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const db = (await import("@core/config/database")).prismaClient;
    await db.user.update({
      where: { id: minor.id },
      data: { birthDate: new Date(`${new Date().getUTCFullYear() - 17}-01-15T00:00:00.000Z`) },
    });

    const blocked = await createRequest({ userId: minor.id }, admin.token);
    expectError(blocked, 400, "MINOR_OVERTIME_FORBIDDEN", "solicitud a menor");

    const forbidden = await createRequest({}, staff.token);
    expectError(forbidden, 403, "INSUFFICIENT_PERMISSIONS", "trabajador creando solicitudes");

    const invalid = await createRequest({ plannedMin: 0 }, admin.token);
    expectError(invalid, 400, "INVALID_OVERTIME_REQUEST", "solicitud sin minutos");
  });
});
