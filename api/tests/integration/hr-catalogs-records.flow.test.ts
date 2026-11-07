/**
 * Catálogos de RH, expediente documental y actas administrativas (HR-01..04):
 * reglas de alta/edición/baja que usan los diálogos HR-M02..M05 y las rutas
 * de documentos del expediente.
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

describe("catálogos y expediente", () => {
  test("[HR-04][HR-M04][HR-M05] tipos de documento: crear, editar, desactivar y eliminar", async () => {
    const tenant = await createTenant();
    const admin = await platformSession("ADMIN");

    const created = await api("POST", "/hr/catalogs/document-types", {
      token: admin.token,
      tenantId: tenant.id,
      body: { name: "Constancia de estudios", required: false },
    });
    expectStatus(created, 201, "alta de tipo de documento");
    const id = String(created.body?.id);

    const listed = await api("GET", "/hr/catalogs/document-types", { token: admin.token, tenantId: tenant.id });
    expectStatus(listed, 200, "lista de tipos");
    assert.ok((listed.body as Array<{ id: string }>).some((row) => row.id === id));

    const renamed = await api("PATCH", `/hr/catalogs/document-types/${id}`, {
      token: admin.token,
      tenantId: tenant.id,
      body: { name: "Constancia académica", sortOrder: 3 },
    });
    expectStatus(renamed, 200, "edición de tipo");
    assert.equal(renamed.body?.name, "Constancia académica");

    const deactivated = await api("PATCH", `/hr/catalogs/document-types/${id}`, {
      token: admin.token,
      tenantId: tenant.id,
      body: { active: false },
    });
    expectStatus(deactivated, 200, "desactivar tipo");
    assert.equal(deactivated.body?.active, false);

    const removed = await api("DELETE", `/hr/catalogs/document-types/${id}`, { token: admin.token, tenantId: tenant.id });
    expectStatus(removed, 200, "eliminar tipo inactivo");
    const afterDelete = await api("GET", "/hr/catalogs/document-types", { token: admin.token, tenantId: tenant.id });
    assert.equal((afterDelete.body as Array<{ id: string }>).some((row) => row.id === id), false);
  });

  test("[HR-04] catálogos de género y tipo de sangre: no borrar en uso", async () => {
    const tenant = await createTenant();
    const admin = await platformSession("ADMIN");

    const gender = await api("POST", "/hr/catalogs/genders", {
      token: admin.token,
      tenantId: tenant.id,
      body: { name: "No binario" },
    });
    expectStatus(gender, 201, "alta de género");
    const genderId = String(gender.body?.id);

    const employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    // Deja el género en uso por un expediente.
    const { prismaClient } = await import("@core/config/database");
    const { runWithTenant } = await import("@core/tenancy/context");
    const attached = await runWithTenant(tenant.id, async () => {
      await prismaClient.user.update({ where: { id: employee.id }, data: { genderId } });
      return prismaClient.user.count({ where: { genderId } });
    });
    assert.equal(attached, 1, "el empleado quedó con el género");
    const soft = await api("DELETE", `/hr/catalogs/genders/${genderId}`, { token: admin.token, tenantId: tenant.id });
    expectStatus(soft, 200, "primer borrado desactiva (en uso)");
    assert.equal(soft.body?.soft, true);
    const used = await api("DELETE", `/hr/catalogs/genders/${genderId}`, { token: admin.token, tenantId: tenant.id });
    expectError(used, 400, "GENDER_IN_USE", "borrar género en uso");

    const blood = await api("POST", "/hr/catalogs/blood-types", {
      token: admin.token,
      tenantId: tenant.id,
      body: { name: "AB+" },
    });
    expectStatus(blood, 201, "alta tipo de sangre");
    const bloodId = String(blood.body?.id);
    const del = await api("DELETE", `/hr/catalogs/blood-types/${bloodId}`, { token: admin.token, tenantId: tenant.id });
    expectStatus(del, 200, "tipo de sangre sin uso se elimina");
  });

  test("[EMP-04-T2][ACT-16] documentos del expediente: subida sin archivo y baja inexistente", async () => {
    const tenant = await createTenant();
    const employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    // El endpoint valida el archivo antes de tocar S3 (con un tipo válido).
    const admin = await platformSession("ADMIN");
    const type = await api("POST", "/hr/catalogs/document-types", {
      token: admin.token,
      tenantId: tenant.id,
      body: { name: "Identificación oficial" },
    });
    expectStatus(type, 201, "tipo de documento para subir");
    const documentTypeId = String(type.body?.id);
    const noFile = await api("POST", `/hr/${employee.id}/documents`, {
      token: admin.token,
      tenantId: tenant.id,
      body: { documentTypeId },
    });
    expectStatus(noFile, 400, "subida sin archivo");

    const missing = await api("DELETE", `/hr/${employee.id}/documents/no-existe`, { token: admin.token });
    expectStatus(missing, 404, "baja de documento inexistente");

    const download = await api("GET", `/hr/${employee.id}/documents/no-existe/download`, {
      token: admin.token,
    });
    expectStatus(download, 404, "descarga de documento inexistente");
  });

  test("[HR-02][HR-03][HR-M02][HR-M03][ACT-17] actas administrativas: alta, detalle, listado y baja", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const created = await api("POST", "/hr/disciplinary-reports", {
      token: admin.token,
      body: {
        userId: employee.id,
        reason: "TARDINESS",
        incidentDate: "2026-11-02",
        description: "Llegó 40 minutos tarde sin aviso.",
        sanction: "Llamada de atención",
      },
    });
    expectStatus(created, 201, "alta de acta");
    const reportId = String(created.body?.id);

    const detail = await api("GET", `/hr/disciplinary-reports/${reportId}`, { token: admin.token });
    expectStatus(detail, 200, "detalle de acta");
    assert.equal(detail.body?.reason, "TARDINESS");

    const byEmployee = await api("GET", `/hr/disciplinary-reports/employee/${employee.id}`, {
      token: admin.token,
    });
    expectStatus(byEmployee, 200, "actas de la persona");
    assert.ok((byEmployee.body as Array<{ id: string }>).some((row) => row.id === reportId));

    const shortDescription = await api("POST", "/hr/disciplinary-reports", {
      token: admin.token,
      body: { userId: employee.id, reason: "OTHER", incidentDate: "2026-11-02", description: "x" },
    });
    expectStatus(shortDescription, 400, "descripción demasiado corta");

    const removed = await api("DELETE", `/hr/disciplinary-reports/${reportId}`, { token: admin.token });
    expectStatus(removed, 200, "eliminar acta");
    const gone = await api("GET", `/hr/disciplinary-reports/${reportId}`, { token: admin.token });
    expectStatus(gone, 404, "acta eliminada");
  });

  test("[HR-02] actas aisladas por cliente", async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const adminA = await clientSession("CLIENT_ADMIN", { tenant: tenantA });
    const adminB = await clientSession("CLIENT_ADMIN", { tenant: tenantB });
    const employee = await createUser({ tenantId: tenantA.id, role: "CLIENT_STAFF" });

    const created = await api("POST", "/hr/disciplinary-reports", {
      token: adminA.token,
      body: { userId: employee.id, reason: "MISCONDUCT", incidentDate: "2026-11-03", description: "Falta de respeto." },
    });
    expectStatus(created, 201, "acta del cliente A");
    const reportId = String(created.body?.id);

    const cross = await api("GET", `/hr/disciplinary-reports/${reportId}`, { token: adminB.token });
    expectError(cross, 404, "DISCIPLINARY_REPORT_NOT_FOUND", "acta de otro cliente");
  });
});
