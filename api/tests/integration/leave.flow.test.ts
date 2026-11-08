/**
 * Vacaciones y permisos: tipos configurables, saldo devengado, solicitud y
 * aprobación (F4/P1 del plan de cumplimiento).
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
let admin: Session;
let staff: Session;
let vacationTypeId: string;
let unpaidTypeId: string;

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  staff = await clientSession("CLIENT_STAFF", { tenant });
  const db = (await import("@core/config/database")).prismaClient;
  await db.user.update({
    where: { id: staff.user.id },
    data: { hireDate: new Date("2024-01-15T00:00:00.000Z") },
  });

  const types = await api("GET", "/nom/leave/types", { token: admin.token });
  expectStatus(types, 200, "tipos de permiso");
  const rows = types.body as unknown as Array<{ id: string; key: string }>;
  assert.equal(rows.length, 4, "siembra los 4 tipos base");
  vacationTypeId = rows.find((row) => row.key === "VACACIONES")!.id;
  unpaidTypeId = rows.find((row) => row.key === "PERMISO_SIN_GOCE")!.id;
});

after(async () => {
  await stopSuite();
});

describe("vacaciones y permisos", () => {
  test("el saldo devengado y la solicitud/aprobación de vacaciones", async () => {
    const balance = await api("GET", "/nom/me/leave/balance?year=2027", { token: staff.token });
    expectStatus(balance, 200, "saldo de vacaciones");
    assert.equal(balance.body?.entitlementDays, 16, "3 años de antigüedad → 16 días");
    assert.equal(balance.body?.availableDays, 16);

    const request = await api("POST", "/nom/me/leave/requests", {
      token: staff.token,
      body: {
        typeId: vacationTypeId,
        startDate: "2027-06-01",
        endDate: "2027-06-03",
        reason: "Vacaciones de verano",
      },
    });
    expectStatus(request, 201, "solicitud de vacaciones");
    assert.equal(request.body?.days, 3);
    assert.equal(request.body?.status, "PENDING");

    const pending = await api("GET", "/nom/me/leave/balance?year=2027", { token: staff.token });
    assert.equal(pending.body?.pendingDays, 3);

    const overlap = await api("POST", "/nom/me/leave/requests", {
      token: staff.token,
      body: { typeId: vacationTypeId, startDate: "2027-06-02", endDate: "2027-06-04" },
    });
    expectError(overlap, 409, "LEAVE_OVERLAP", "solicitud encimada");

    const tooMany = await api("POST", "/nom/me/leave/requests", {
      token: staff.token,
      body: { typeId: vacationTypeId, startDate: "2027-07-01", endDate: "2027-07-31" },
    });
    expectError(tooMany, 400, "INSUFFICIENT_VACATION_DAYS", "más días que el saldo");

    const list = await api("GET", "/nom/leave/requests", { token: admin.token });
    expectStatus(list, 200, "RH lista solicitudes");
    const approved = await api("POST", `/nom/leave/requests/${request.body?.id}/decide`, {
      token: admin.token,
      body: { approve: true, note: "Autorizado" },
    });
    expectStatus(approved, 200, "aprobación de vacaciones");
    assert.equal(approved.body?.status, "APPROVED");

    const used = await api("GET", "/nom/me/leave/balance?year=2027", { token: staff.token });
    assert.equal(used.body?.usedDays, 3);
    assert.equal(used.body?.availableDays, 13);
  });

  test("permiso sin goce y cancelación de pendientes", async () => {
    const leave = await api("POST", "/nom/me/leave/requests", {
      token: staff.token,
      body: {
        typeId: unpaidTypeId,
        startDate: "2027-08-03",
        endDate: "2027-08-04",
        reason: "Asunto personal",
      },
    });
    expectStatus(leave, 201, "permiso sin goce");
    assert.equal(leave.body?.days, 2);

    const cancelled = await api("POST", `/nom/me/leave/requests/${leave.body?.id}/cancel`, {
      token: staff.token,
    });
    expectStatus(cancelled, 200, "cancelación");
    assert.equal(cancelled.body?.status, "CANCELLED");

    const forbidden = await api("GET", "/nom/leave/requests", { token: staff.token });
    expectError(forbidden, 403, "INSUFFICIENT_PERMISSIONS", "trabajador listando todo");
  });
});
