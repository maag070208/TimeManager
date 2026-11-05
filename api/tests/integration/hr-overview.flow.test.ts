/**
 * Actividad del expediente (`GET /hr/:id/overview`, L-13): el resumen que
 * consume la pestaña "Actividad" de la ficha de la persona. Cubre documentos
 * (cargados/faltantes), checadas, actas, horario vigente, el guard de
 * `hr.records` y el aislamiento entre clientes.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createPunch,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
} from "./harness";

const prismaClient = async () => (await import("@core/config/database")).prismaClient;
const tenancy = async () => import("@core/tenancy/context");

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("GET /hr/:id/overview", () => {
  test("el CLIENT_ADMIN ve documentos, faltantes, checadas y horario de su personal", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const employeeNumber = unique("EMP").toUpperCase();
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber,
      jobTitle: "Analista",
    });

    const client = await prismaClient();
    const { runWithTenant } = await tenancy();
    const scheduleName = `Horario ${unique("h")}`;
    const requiredName = `Requerido ${unique("d")}`;
    let optionalName = `Opcional ${unique("d")}`;
    await runWithTenant(tenant.id, async () => {
      const required = await client.documentType.create({
        data: { name: requiredName, required: true, active: true },
      });
      const optional = await client.documentType.create({
        data: { name: optionalName, required: false, active: true },
      });
      optionalName = optional.name;
      await client.employeeDocument.create({
        data: {
          userId: employee.id,
          documentTypeId: required.id,
          storageKey: unique("sk"),
          originalName: "ine.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedById: admin.user.id,
        },
      });
      const schedule = await client.schedule.create({ data: { name: scheduleName } });
      await client.scheduleAssignment.create({
        data: {
          userId: employee.id,
          scheduleId: schedule.id,
          validFrom: new Date(Date.now() - 86_400_000),
        },
      });
    });

    await createPunch(tenant.id, {
      employeeNumber,
      name: "Analista",
      clockSerial: unique("RELOJ"),
    });

    const overview = await api("GET", `/hr/${employee.id}/overview`, { token: admin.token });
    expectStatus(overview, 200, "actividad del expediente");
    assert.equal(overview.body?.employee?.id, employee.id);
    assert.equal(overview.body?.employee?.employeeNumber, employeeNumber);
    assert.equal(overview.body?.employee?.jobTitle, "Analista");
    assert.equal(overview.body?.employee?.active, true);

    assert.equal(overview.body?.summary?.documents, 1);
    assert.equal(overview.body?.summary?.missingRequiredDocuments, 0);
    assert.equal(overview.body?.summary?.punchesLast30Days, 1);
    assert.equal(overview.body?.summary?.disciplinaryReportsLastYear, 0);

    assert.equal(overview.body?.documents?.length, 1);
    assert.equal(overview.body?.documents?.[0]?.name, "ine.pdf");
    assert.equal(overview.body?.documents?.[0]?.type, requiredName);
    assert.ok(optionalName, "el tipo opcional también existe");

    assert.equal(overview.body?.punches?.length, 1);
    assert.equal(overview.body?.punches?.[0]?.method, "FACE");

    assert.equal(overview.body?.schedule?.name, scheduleName);
  });

  test("un documento obligatorio sin cargar se reporta como faltante", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const client = await prismaClient();
    const { runWithTenant } = await tenancy();
    await runWithTenant(tenant.id, async () => {
      await client.documentType.create({ data: { name: `Req ${unique("d")}`, required: true } });
      await client.documentType.create({ data: { name: `Req ${unique("d")}`, required: true } });
    });

    const overview = await api("GET", `/hr/${employee.id}/overview`, { token: admin.token });
    expectStatus(overview, 200, "actividad con faltantes");
    assert.equal(overview.body?.summary?.missingRequiredDocuments, 2);
    assert.equal(overview.body?.summary?.documents, 0);
    assert.deepEqual(overview.body?.documents, []);
    assert.equal(overview.body?.schedule, null);
  });

  test("sin hr.records el resumen responde 403", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    const target = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const response = await api("GET", `/hr/${target.id}/overview`, { token: staff.token });
    expectError(response, 403, "INSUFFICIENT_PERMISSIONS", "actividad sin hr.records");
  });

  test("el resumen está acotado al cliente: el admin de A no lee a B", async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const adminA = await clientSession("CLIENT_ADMIN", { tenant: tenantA });
    const employeeB = await createUser({ tenantId: tenantB.id, role: "CLIENT_STAFF" });

    const response = await api("GET", `/hr/${employeeB.id}/overview`, { token: adminA.token });
    expectError(response, 404, "USER_NOT_FOUND", "actividad de otro cliente");
  });

  test("un id inexistente responde 404", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const response = await api("GET", "/hr/00000000-0000-4000-8000-000000000000/overview", {
      token: admin.token,
    });
    expectError(response, 404, "USER_NOT_FOUND", "actividad de id inexistente");
  });
});
