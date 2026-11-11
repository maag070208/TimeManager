/**
 * Cambio de subdominio de un cliente (`PATCH /tenants/:id` con `slug`): el
 * login pasa a responder en el subdominio nuevo y deja de hacerlo en el viejo;
 * un subdominio repetido o reservado se rechaza.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  createTenant,
  createUser,
  DEFAULT_PASSWORD,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

let admin: Session;
let tenant: TenantFixture;
let other: TenantFixture;
let username: string;

const loginWith = (slug: string) =>
  api("POST", "/auth/login", { body: { username, password: DEFAULT_PASSWORD, tenant: slug } });

before(async () => {
  await setupSuite();
  admin = await platformSession("ADMIN");
  tenant = await createTenant();
  other = await createTenant();
  username = (await createUser({ role: "CLIENT_ADMIN", tenantId: tenant.id })).username;
});

after(async () => {
  await stopSuite();
});

describe("cambio de subdominio del cliente", () => {
  test("rechaza un subdominio repetido o reservado", async () => {
    const taken = await api("PATCH", `/tenants/${tenant.id}`, { token: admin.token, body: { slug: other.slug } });
    expectError(taken, 409, "TENANT_SLUG_TAKEN", "subdominio repetido");
    const reserved = await api("PATCH", `/tenants/${tenant.id}`, { token: admin.token, body: { slug: "admin" } });
    assert.equal(reserved.status, 400, "subdominio reservado");
  });

  test("el login se muda al subdominio nuevo", async () => {
    const previous = tenant.slug;
    const next = unique("nuevo").toLowerCase();
    expectStatus(await loginWith(previous), 200, "login con el subdominio original");

    const updated = await api("PATCH", `/tenants/${tenant.id}`, { token: admin.token, body: { slug: next } });
    expectStatus(updated, 200, "cambio de subdominio");
    assert.equal(updated.body?.slug, next);

    expectStatus(await loginWith(next), 200, "login con el subdominio nuevo");
    assert.notEqual((await loginWith(previous)).status, 200, "el subdominio anterior ya no entra");
  });
});
