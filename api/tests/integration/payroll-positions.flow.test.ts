/**
 * Configuración de nómina y puestos (PAY-03/PAY-04): alta de puesto, edición,
 * asignación de personas y baja lógica; reglas que usan los diálogos PAY-M05/M06.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
  expectStatus,
  setupSuite,
  stopSuite,
} from "./harness";

before(async () => {
  await setupSuite();
});
after(async () => {
  await stopSuite();
});

describe("puestos y configuración de nómina", () => {
  test("[PAY-03][PAY-04][PAY-M05][ACT-27] alta de puesto, edición y baja lógica", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const created = await api("POST", "/payroll/positions", {
      token: admin.token,
      body: { name: "Operador", jobTitle: "Operador de máquina", dailySalary: 315.04, sbcDaily: 320 },
    });
    expectStatus(created, 201, "alta de puesto");
    const id = String(created.body?.id);

    const listed = await api("GET", "/payroll/positions", { token: admin.token });
    expectStatus(listed, 200, "lista de puestos");
    assert.ok((listed.body as Array<{ id: string }>).some((row) => row.id === id));

    const updated = await api("PATCH", `/payroll/positions/${id}`, {
      token: admin.token,
      body: { dailySalary: 330, jobTitle: "Operador senior" },
    });
    expectStatus(updated, 200, "edición de puesto");
    assert.equal(updated.body?.jobTitle, "Operador senior");

    const deactivated = await api("PATCH", `/payroll/positions/${id}`, {
      token: admin.token,
      body: { active: false },
    });
    expectStatus(deactivated, 200, "baja lógica del puesto");
    assert.equal(deactivated.body?.active, false);

    const invalid = await api("POST", "/payroll/positions", {
      token: admin.token,
      body: { name: "X", dailySalary: -1 },
    });
    expectStatus(invalid, 400, "puesto inválido");
  });

  test("[PAY-03][PAY-M06][ACT-27] asignar personas a un puesto activo y no a uno inactivo", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const personA = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const personB = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const created = await api("POST", "/payroll/positions", {
      token: admin.token,
      body: { name: "Cajero", dailySalary: 280 },
    });
    expectStatus(created, 201, "puesto para asignar");
    const id = String(created.body?.id);

    const assigned = await api("PUT", `/payroll/positions/${id}/assign`, {
      token: admin.token,
      body: { userIds: [personA.id, personB.id] },
    });
    expectStatus(assigned, 200, "asignación de personas");
    const row = assigned.body as { id: string; employees?: Array<{ id: string }> };
    assert.equal(row.id, id);
    assert.equal(row.employees?.length, 2);

    // Reasignar sólo a una persona desasigna a la otra.
    const reassigned = await api("PUT", `/payroll/positions/${id}/assign`, {
      token: admin.token,
      body: { userIds: [personA.id] },
    });
    expectStatus(reassigned, 200, "reasignación");
    const afterRow = reassigned.body as { employees?: Array<{ id: string }> };
    assert.equal(afterRow.employees?.length, 1);

    await api("PATCH", `/payroll/positions/${id}`, { token: admin.token, body: { active: false } });
    const inactive = await api("PUT", `/payroll/positions/${id}/assign`, {
      token: admin.token,
      body: { userIds: [personB.id] },
    });
    expectStatus(inactive, 400, "no se asigna a un puesto inactivo");
  });
});
