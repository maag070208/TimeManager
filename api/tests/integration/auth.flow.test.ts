/**
 * Flujo de sesión (F1A-04 + endurecimiento JWT): login multi-tenant, `/auth/me`,
 * refresh con rotación y cambio de contraseña. Es la suite de referencia del
 * arnés: si esto pasa, el resto de las suites pueden confiar en las sesiones.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PASSWORD,
  api,
  clientSession,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  login,
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

describe("login multi-tenant", () => {
  test("plataforma: sin slug entra un ADMIN y la sesión no tiene cliente", async () => {
    const session = await platformSession("ADMIN");
    const me = await api("GET", "/auth/me", { token: session.token });
    expectStatus(me, 200, "me del ADMIN de plataforma");
    assert.equal(me.body?.tenant, null);
    assert.equal(me.body?.role, "ADMIN");
    assert.equal(me.body?.photoUrl, null);
  });

  test("cliente: con slug entra el personal y la sesión trae su cliente", async () => {
    const tenant = await createTenant();
    const session = await clientSession("CLIENT_ADMIN", { tenant });
    const me = await api("GET", "/auth/me", { token: session.token });
    expectStatus(me, 200, "me del CLIENT_ADMIN");
    assert.equal(me.body?.tenant?.slug, tenant.slug);
    assert.equal(typeof me.body?.permissions, "object");
    assert.ok(Object.keys(me.body.permissions).length > 0, "el cliente admin debe tener permisos");
  });

  test("un usuario de cliente no entra sin slug (la vía sin slug es solo de plataforma)", async () => {
    const session = await clientSession("CLIENT_STAFF");
    const response = await api("POST", "/auth/login", {
      body: { username: session.user.username, password: DEFAULT_PASSWORD },
    });
    expectError(response, 401, "INVALID_CREDENTIALS", "login sin slug de usuario de cliente");
  });

  test("slug inexistente responde 401 genérico (no revela clientes)", async () => {
    const response = await api("POST", "/auth/login", {
      body: { username: "quien-sea", password: "x", tenant: "no-existe-jamas" },
    });
    expectError(response, 401, "INVALID_CREDENTIALS", "slug inexistente");
  });

  test("cliente suspendido no deja entrar", async () => {
    const tenant = await createTenant();
    const session = await clientSession("CLIENT_ADMIN", { tenant });
    const client = await (await import("@core/config/database")).prismaClient;
    await client.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });
    const response = await api("POST", "/auth/login", {
      body: { username: session.user.username, password: DEFAULT_PASSWORD, tenant: tenant.slug },
    });
    expectError(response, 403, "TENANT_SUSPENDED", "cliente suspendido");
  });

  test("cuenta dada de baja no deja entrar y expone el motivo", async () => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF", active: false });
    const response = await api("POST", "/auth/login", {
      body: { username: user.username, password: DEFAULT_PASSWORD, tenant: tenant.slug },
    });
    expectError(response, 403, "ACCOUNT_DEACTIVATED", "cuenta inactiva");
  });

  test("contraseña incorrecta responde 401", async () => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const response = await api("POST", "/auth/login", {
      body: { username: user.username, password: "otra-cosa", tenant: tenant.slug },
    });
    expectError(response, 401, "INVALID_CREDENTIALS", "contraseña incorrecta");
  });
});

describe("/auth/me", () => {
  test("sin token responde 401 TOKEN_MISSING", async () => {
    const response = await api("GET", "/auth/me");
    expectError(response, 401, "TOKEN_MISSING", "me sin token");
  });

  test("token basura responde 401 INVALID_TOKEN", async () => {
    const response = await api("GET", "/auth/me", { token: "no-es-un-jwt" });
    expectError(response, 401, "INVALID_TOKEN", "me con token basura");
  });

  test("el cliente suspendido en caliente corta la sesión vigente", async () => {
    const tenant = await createTenant();
    const session = await clientSession("CLIENT_ADMIN", { tenant });
    const client = await (await import("@core/config/database")).prismaClient;
    await client.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });
    const me = await api("GET", "/auth/me", { token: session.token });
    expectError(me, 403, "TENANT_SUSPENDED", "me con cliente suspendido");
  });
});

describe("refresh y cambio de contraseña", () => {
  test("el refresh rota los tokens y el access nuevo sirve", async () => {
    const session = await clientSession("HUMAN_RESOURCES");
    // Los JWT llevan `iat` en segundos: dos firmas en el mismo segundo son
    // idénticas. Se espera un segundo para observar la rotación de verdad.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const response = await api("POST", "/auth/refresh", {
      body: { refreshToken: session.refreshToken },
    });
    expectStatus(response, 200, "refresh");
    assert.notEqual(response.body?.token, session.token);
    assert.notEqual(response.body?.refreshToken, session.refreshToken);
    const me = await api("GET", "/auth/me", { token: response.body?.token });
    expectStatus(me, 200, "me con token refrescado");
    assert.equal(me.body?.id, session.user.id);
  });

  test("un refresh token usado como access no sirve", async () => {
    const session = await clientSession("CLIENT_STAFF");
    const response = await api("GET", "/auth/me", { token: session.refreshToken });
    expectError(response, 401, "INVALID_TOKEN", "refresh token como access");
  });

  test("refresh inválido responde 401 INVALID_REFRESH_TOKEN", async () => {
    const response = await api("POST", "/auth/refresh", { body: { refreshToken: "basura" } });
    expectError(response, 401, "INVALID_REFRESH_TOKEN", "refresh inválido");
  });

  test("cambiar contraseña invalida la anterior y limpia el aviso de provisional", async () => {
    const tenant = await createTenant();
    const user = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      mustChangePassword: true,
    });
    const tokens = await login({ username: user.username, tenant: tenant.slug });
    assert.equal(tokens.user?.mustChangePassword, true);

    const changed = await api("POST", "/auth/change-password", {
      token: tokens.token,
      body: { currentPassword: DEFAULT_PASSWORD, newPassword: "NuevaClave123!" },
    });
    expectStatus(changed, 204, "cambio de contraseña");

    const oldLogin = await api("POST", "/auth/login", {
      body: { username: user.username, password: DEFAULT_PASSWORD, tenant: tenant.slug },
    });
    expectError(oldLogin, 401, "INVALID_CREDENTIALS", "login con la contraseña vieja");

    const newLogin = await api("POST", "/auth/login", {
      body: { username: user.username, password: "NuevaClave123!", tenant: tenant.slug },
    });
    expectStatus(newLogin, 200, "login con la contraseña nueva");
    assert.equal(newLogin.body?.user?.mustChangePassword, false);
  });
});
