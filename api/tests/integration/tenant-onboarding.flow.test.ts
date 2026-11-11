/**
 * Alta de cliente de punta a punta (`POST /tenants`): el administrador que se
 * crea puede entrar por el subdominio del cliente, con contraseña generada o
 * definida por plataforma, se le obliga a cambiarla y luego entra con la nueva.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { api, expectError, expectStatus, platformSession, setupSuite, stopSuite, unique, type Session } from "./harness";

let platform: Session;

const createClient = (admin: Record<string, unknown>) => {
  const slug = unique("alta").toLowerCase();
  return api("POST", "/tenants", {
    token: platform.token,
    body: { name: `Cliente ${slug}`, slug, admin: { name: "María Pérez", username: "maria.perez", ...admin } },
  }).then((response) => ({ response, slug }));
};

const login = (slug: string | undefined, username: string, password: string) =>
  api("POST", "/auth/login", { body: { username, password, ...(slug ? { tenant: slug } : {}) } });

before(async () => {
  await setupSuite();
  platform = await platformSession("ADMIN");
});

after(async () => {
  await stopSuite();
});

describe("alta de cliente: su administrador puede entrar", () => {
  test("con contraseña generada entra, cambia la contraseña y vuelve a entrar", async () => {
    const { response, slug } = await createClient({});
    expectStatus(response, 201, "alta de cliente");
    const temporary = response.body?.temporaryPassword as string;
    assert.ok(temporary, "la contraseña provisional se devuelve una vez");
    assert.equal(response.body?.admin?.username, "maria.perez");

    const first = await login(slug, "maria.perez", temporary);
    expectStatus(first, 200, "primer login del administrador");
    assert.equal(first.body?.user?.role, "CLIENT_ADMIN");
    assert.equal(first.body?.user?.mustChangePassword, true);

    const next = "NuevaClave2027!";
    const changed = await api("POST", "/auth/change-password", {
      token: first.body?.token as string,
      body: { currentPassword: temporary, newPassword: next },
    });
    expectStatus(changed, 204, "cambio de contraseña obligatorio");

    const second = await login(slug, "maria.perez", next);
    expectStatus(second, 200, "login con la contraseña nueva");
    assert.equal(second.body?.user?.mustChangePassword, false);
    expectError(await login(slug, "maria.perez", temporary), 401, "INVALID_CREDENTIALS", "la provisional ya no sirve");
  });

  test("con contraseña definida por plataforma entra y no se devuelve la contraseña", async () => {
    const { response, slug } = await createClient({ password: "Admin123" });
    expectStatus(response, 201, "alta con contraseña definida");
    assert.equal(response.body?.temporaryPassword, undefined);

    const first = await login(slug, "maria.perez", "Admin123");
    expectStatus(first, 200, "login con la contraseña definida");
    assert.equal(first.body?.user?.mustChangePassword, true);
  });

  test("solo entra por su subdominio: ni sin cliente ni con una cuenta de plataforma", async () => {
    const { response, slug } = await createClient({ password: "Admin123" });
    expectStatus(response, 201, "alta de cliente");
    expectError(await login(undefined, "maria.perez", "Admin123"), 401, "INVALID_CREDENTIALS", "sin subdominio");
    expectError(await login(slug, platform.user.username, "Admin123"), 401, "INVALID_CREDENTIALS", "cuenta de plataforma en el subdominio del cliente");
  });
});
