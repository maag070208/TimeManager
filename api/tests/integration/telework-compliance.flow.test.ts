/**
 * F4 — Brechas NOM-037: % teletrabajo, validación del checklist, equipo,
 * capacitación, avisos y reversibilidad.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
  type Session,
  type TenantFixture,
} from "./harness";

let tenant: TenantFixture;
let hr: Session;
let staff: Session;
let registrationId: string;

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  hr = await clientSession("HUMAN_RESOURCES", { tenant });
  staff = await clientSession("CLIENT_STAFF", { tenant });

  const registered = await api("POST", "/nom/telework/registrations", {
    token: hr.token,
    body: { userId: staff.user.id, mode: "REMOTO", homeAddress: "Calle Demo 123" },
  });
  expectStatus(registered, 201, "registro de teletrabajo");
  registrationId = registered.body?.id as string;
});

after(async () => {
  await stopSuite();
});

describe("F4 NOM-037: brechas P0", () => {
  test("el % de teletrabajo y los datos del puesto se guardan y validan", async () => {
    const updated = await api("PATCH", `/nom/telework/registrations/${registrationId}/details`, {
      token: hr.token,
      body: {
        teleworkPercent: 60,
        activities: "Atención a clientes y captura",
        position: "Analista",
        workPlaces: ["Domicilio", "Oficina"],
      },
    });
    expectStatus(updated, 200, "detalles de teletrabajo");
    assert.equal(updated.body?.teleworkPercent, 60);

    const invalid = await api("PATCH", `/nom/telework/registrations/${registrationId}/details`, {
      token: hr.token,
      body: { teleworkPercent: 130 },
    });
    expectError(invalid, 400, "INVALID_TELEWORK_PERCENT", "porcentaje inválido");
  });

  test("la Comisión valida el checklist y un NO_APTO bloquea el marcaje remoto", async () => {
    const db = (await import("@core/config/database")).prismaClient;
    const checklist = await db.teleworkChecklist.create({
      data: {
        tenantId: tenant.id,
        registrationId,
        userId: staff.user.id,
        kind: "INITIAL",
        answers: { space_adequate: "NO" },
      },
    });

    const validated = await api("POST", `/nom/telework/checklists/${checklist.id}/validate`, {
      token: hr.token,
      body: { result: "NO_APTO", notes: "Espacio sin ventilación" },
    });
    expectStatus(validated, 200, "validación del checklist");
    assert.equal(validated.body?.result, "NO_APTO");
    assert.ok(validated.body?.validatedAt);

    const blocked = await api("POST", "/nom/me/punch", {
      token: staff.token,
      body: { type: "ENTRY", workMode: "REMOTO" },
    });
    expectError(blocked, 403, "TELEWORK_WORKPLACE_NOT_APPROVED", "marcaje en lugar NO_APTO");
  });

  test("equipo entregado con acuse, capacitación, avisos y reversibilidad", async () => {
    const equipment = await api("POST", "/nom/telework/equipment", {
      token: hr.token,
      body: { userId: staff.user.id, items: ["Laptop", "Silla ergonómica"], notes: "Entrega inicial" },
    });
    expectStatus(equipment, 201, "entrega de equipo");

    const accepted = await api("POST", `/nom/me/telework/equipment/${equipment.body?.id}/accept`, {
      token: staff.token,
    });
    expectStatus(accepted, 200, "acuse de equipo");
    assert.match(String(accepted.body?.acceptedHash), /^[0-9a-f]{64}$/);

    const training = await api("POST", "/nom/telework/trainings", {
      token: hr.token,
      body: {
        userId: staff.user.id,
        completedAt: "2026-11-01",
        expiresAt: "2027-11-01",
        evidence: "Constancia interna",
      },
    });
    expectStatus(training, 201, "capacitación registrada");

    const notice = await api("POST", "/nom/me/telework/notices", {
      token: staff.token,
      body: {
        kind: "ADDRESS_CHANGE",
        occurredAt: "2026-11-02",
        description: "Cambio de domicilio a Calle Nueva 456",
      },
    });
    expectStatus(notice, 201, "aviso del trabajador");

    const reversal = await api("POST", "/nom/me/telework/reversal", {
      token: staff.token,
      body: { reason: "Necesito volver a la oficina por salud" },
    });
    expectStatus(reversal, 201, "solicitud de reversibilidad");

    const decided = await api("POST", `/nom/telework/reversals/${reversal.body?.id}/decide`, {
      token: hr.token,
      body: { approve: true, note: "Se autoriza el regreso" },
    });
    expectStatus(decided, 200, "decisión de reversibilidad");
    assert.equal(decided.body?.status, "APPROVED");

    const lists = await Promise.all([
      api("GET", "/nom/telework/equipment", { token: hr.token }),
      api("GET", "/nom/telework/trainings", { token: hr.token }),
      api("GET", "/nom/telework/notices", { token: hr.token }),
      api("GET", "/nom/telework/reversals", { token: hr.token }),
    ]);
    for (const response of lists) expectStatus(response, 200, "listados NOM-037");
  });
});
