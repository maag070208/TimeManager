/**
 * RBAC/ABAC de plataforma (PLAT-06): catálogo, roles, matriz y recarga.
 * Endpoints solo de plataforma (`roles.manage`).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
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

describe("roles y matriz de permisos", () => {
  test("[PLAT-06-T1][PLAT-M08][ACT-08] crear, renombrar y proteger roles de sistema", async () => {
    const platform = await platformSession("ADMIN");

    const roles = await api("GET", "/permissions/roles", { token: platform.token });
    expectStatus(roles, 200, "catálogo de roles");
    assert.ok(Array.isArray(roles.body));

    const roleKey = `QA${Date.now().toString().slice(-6)}`;
    const created = await api("POST", "/permissions/roles", {
      token: platform.token,
      body: { key: roleKey, name: "Supervisor QA", copyFrom: "CLIENT_STAFF" },
    });
    expectStatus(created, 201, "alta de rol");
    assert.equal(created.body?.key, roleKey);

    const renamed = await api("PATCH", `/permissions/roles/${roleKey}`, {
      token: platform.token,
      body: { name: "Supervisor de calidad" },
    });
    expectStatus(renamed, 200, "edición de rol");
    assert.equal(renamed.body?.name, "Supervisor de calidad");

    const protectedRole = await api("DELETE", "/permissions/roles/ADMIN", { token: platform.token });
    expectStatus(protectedRole, 409, "no se elimina un rol de sistema");

    const removed = await api("DELETE", `/permissions/roles/${roleKey}`, { token: platform.token });
    expectStatus(removed, 204, "baja del rol creado");
  });

  test("[PLAT-06-T2][PLAT-06-T5][PLAT-M11][ACT-09][ACT-11] catálogo, matriz y recarga", async () => {
    const platform = await platformSession("ADMIN");

    const catalog = await api("GET", "/permissions/catalog", { token: platform.token });
    expectStatus(catalog, 200, "catálogo de permisos");
    assert.ok(Array.isArray(catalog.body));

    const permission = await api("POST", "/permissions/catalog", {
      token: platform.token,
      body: {
        key: "qa.rule",
        module: "QA",
        name: "Ver reglas QA",
        scopes: ["NONE", "OWN", "ALL"],
      },
    });
    expectStatus(permission, 201, "alta de permiso");
    assert.equal(permission.body?.key, "qa.rule");

    const matrix = await api("PUT", "/permissions/matrix", {
      token: platform.token,
      body: { changes: [{ role: "CLIENT_STAFF", permission: "qa.rule", scope: "OWN" }] },
    });
    expectStatus(matrix, 200, "aplicar matriz");

    const admin = await api("GET", "/permissions/admin", { token: platform.token });
    expectStatus(admin, 200, "administración de roles");

    const deactivated = await api("PATCH", "/permissions/catalog/qa.rule", {
      token: platform.token,
      body: { active: false },
    });
    expectStatus(deactivated, 200, "desactivar permiso");

    const reload = await api("POST", "/permissions/reload", { token: platform.token });
    expectStatus(reload, 200, "recargar catálogo y matriz");
  });

  test("[PLAT-06] el cliente no administra roles ni la matriz", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    const forbidden = await api("PUT", "/permissions/matrix", {
      token: staff.token,
      body: { changes: [{ role: "CLIENT_STAFF", permission: "time_clock.view", scope: "ALL" }] },
    });
    expectError(forbidden, 403, "INSUFFICIENT_PERMISSIONS", "matriz desde cliente");
  });
});
