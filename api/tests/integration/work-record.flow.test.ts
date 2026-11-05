/**
 * F3 — Prueba plena del registro: acuerdo del método y conformidad periódica.
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
let staff: Session;
let hr: Session;

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  hr = await clientSession("HUMAN_RESOURCES", { tenant });
  staff = await clientSession("CLIENT_STAFF", { tenant });
});

after(async () => {
  await stopSuite();
});

describe("F3 acuerdo de método de registro y conformidad periódica", () => {
  test("el trabajador acepta el método y queda firmado con hash y versión", async () => {
    const initial = await api("GET", "/nom/me/record-agreement", { token: staff.token });
    expectStatus(initial, 200, "acuerdo inicial");

    const accepted = await api("POST", "/nom/me/record-agreement/accept", {
      token: staff.token,
      body: {
        methods: ["CLOCK", "REMOTE"],
        roundingPolicy: "Minutos exactos; sin redondeo en el registro",
        correctionRules: "Cualquier corrección pasa por ajuste documentado",
      },
    });
    expectStatus(accepted, 200, "aceptación del método");
    assert.match(String(accepted.body?.acceptedHash), /^[0-9a-f]{64}$/);
    assert.equal(accepted.body?.textVersion, 1);
    assert.ok(accepted.body?.acceptedAt);

    const mine = await api("GET", "/nom/me/record-agreement", { token: staff.token });
    assert.equal(mine.body?.acceptedHash, accepted.body?.acceptedHash);

    const invalid = await api("POST", "/nom/me/record-agreement/accept", {
      token: staff.token,
      body: { methods: ["TELEPATHY"] },
    });
    expectError(invalid, 400, "INVALID_RECORD_METHODS", "método inválido");

    const adminList = await api("GET", "/nom/record-agreements", { token: hr.token });
    expectStatus(adminList, 200, "RH lista acuerdos");
    assert.ok(
      (adminList.body as unknown as Array<{ userId: string }>).some((row) => row.userId === staff.user.id)
    );

    const denied = await api("GET", "/nom/record-agreements", { token: staff.token });
    expectError(denied, 403, "INSUFFICIENT_PERMISSIONS", "trabajador no lista acuerdos");
  });

  test("el trabajador acepta o discrepa su resumen periódico", async () => {
    const accepted = await api("POST", "/nom/me/record-acknowledgments", {
      token: staff.token,
      body: { periodStart: "2027-01-04", periodEnd: "2027-01-10", accept: true },
    });
    expectStatus(accepted, 201, "conformidad aceptada");
    assert.equal(accepted.body?.status, "ACCEPTED");
    assert.match(String(accepted.body?.summaryHash), /^[0-9a-f]{64}$/);

    const missingNote = await api("POST", "/nom/me/record-acknowledgments", {
      token: staff.token,
      body: { periodStart: "2027-01-11", periodEnd: "2027-01-17", accept: false },
    });
    expectError(missingNote, 400, "DISCREPANCY_NOTE_REQUIRED", "discrepancia sin nota");

    const discrepancy = await api("POST", "/nom/me/record-acknowledgments", {
      token: staff.token,
      body: {
        periodStart: "2027-01-11",
        periodEnd: "2027-01-17",
        accept: false,
        note: "Falta la salida del martes",
      },
    });
    expectStatus(discrepancy, 201, "discrepancia registrada");
    assert.equal(discrepancy.body?.status, "DISCREPANCY");

    const mine = await api("GET", "/nom/me/record-acknowledgments", { token: staff.token });
    expectStatus(mine, 200, "mis conformidades");
    assert.equal((mine.body as unknown[]).length, 2);

    const invalidPeriod = await api("POST", "/nom/me/record-acknowledgments", {
      token: staff.token,
      body: { periodStart: "2027-01-17", periodEnd: "2027-01-11", accept: true },
    });
    expectError(invalidPeriod, 400, "INVALID_ACK_PERIOD", "periodo invertido");

    const adminList = await api("GET", "/nom/record-acknowledgments", { token: hr.token });
    expectStatus(adminList, 200, "RH lista conformidades");
    assert.equal((adminList.body as unknown[]).length, 2);
  });
});
