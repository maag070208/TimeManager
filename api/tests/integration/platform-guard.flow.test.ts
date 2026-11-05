/**
 * F1A-12 — Defensa en profundidad de las rutas de plataforma: además del
 * permiso (`roles.manage`, `system.configure`) se exige usuario de plataforma.
 * Una excepción de permiso a un usuario de cliente no debe abrir las consolas
 * de roles ni la configuración global.
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
  type Session,
} from "./harness";

const db = async () => (await import("@core/config/database")).prismaClient;

let platform: Session;
let clientAdmin: Session;

before(async () => {
  await setupSuite();
  platform = await platformSession("ADMIN");
  const tenant = await createTenant();
  clientAdmin = await clientSession("CLIENT_ADMIN", { tenant });

  // Excepción que, sin la guarda de plataforma, abriría la consola de roles y
  // la configuración global a un usuario de cliente.
  const client = await db();
  for (const permission of ["roles.manage", "system.configure"]) {
    await client.userPermission.create({
      data: {
        userId: clientAdmin.user.id,
        permission,
        scope: "ALL",
        reason: "Excepción de prueba F1A-12",
        grantedById: platform.user.id,
      },
    });
  }
});

after(async () => {
  await stopSuite();
});

describe("rutas de plataforma", () => {
  test("un usuario de cliente con excepción de roles.manage recibe 403", async () => {
    await expectError(
      await api("GET", "/permissions/admin", { token: clientAdmin.token }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "consola de roles con excepción"
    );
    await expectError(
      await api("GET", "/permissions/policies", { token: clientAdmin.token }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "policies con excepción"
    );
    await expectError(
      await api("PUT", "/permissions/matrix", {
        token: clientAdmin.token,
        body: { cells: [] },
      }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "matriz de permisos con excepción"
    );
    await expectError(
      await api("POST", "/permissions/catalog", {
        token: clientAdmin.token,
        body: { key: "x.test", module: "X", name: "X", scopes: ["ALL"] },
      }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "catálogo global con excepción"
    );
  });

  test("un usuario de cliente con excepción de system.configure recibe 403", async () => {
    await expectError(
      await api("GET", "/sys-config", { token: clientAdmin.token }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "listado de configuración con excepción"
    );
    await expectError(
      await api("PUT", "/sys-config/LANGUAGE", {
        token: clientAdmin.token,
        body: { value: "en" },
      }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "configuración global con excepción"
    );
    await expectError(
      await api("DELETE", "/sys-config/LANGUAGE", { token: clientAdmin.token }),
      403,
      "INSUFFICIENT_PERMISSIONS",
      "borrar configuración con excepción"
    );
  });

  test("la lectura compartida (roles/catálogo y config por llave) sigue abierta a clientes", async () => {
    const roles = await api("GET", "/permissions/roles", { token: clientAdmin.token });
    expectStatus(roles, 200, "catálogo de roles para la web");
    assert.ok(Array.isArray(roles.body), "las rutas de lectura compartida no cambian");

    const catalog = await api("GET", "/permissions/catalog", { token: clientAdmin.token });
    expectStatus(catalog, 200, "catálogo de permisos para la web");

    const seeded = await api("PUT", "/sys-config/LANGUAGE", {
      token: platform.token,
      body: { value: "es" },
    });
    expectStatus(seeded, 200, "configuración escrita por plataforma");

    const settings = await api("GET", "/sys-config/LANGUAGE", { token: clientAdmin.token });
    expectStatus(settings, 200, "configuración pública por llave");
  });

  test("el personal de plataforma sí entra a roles, policies y configuración", async () => {
    const admin = await api("GET", "/permissions/admin", { token: platform.token });
    expectStatus(admin, 200, "consola de roles de plataforma");
    assert.ok(admin.body?.roles, "la consola trae roles");
    assert.ok(admin.body?.catalog, "la consola trae el catálogo");

    const policies = await api("GET", "/permissions/policies", { token: platform.token });
    expectStatus(policies, 200, "policies de plataforma");

    const config = await api("GET", "/sys-config", { token: platform.token });
    expectStatus(config, 200, "configuración de plataforma");
  });
});
