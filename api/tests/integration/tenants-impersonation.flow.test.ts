/**
 * F3-03 — "Entrar como cliente" para soporte. El flujo ya existía (la consola
 * elige al cliente y la API opera con `X-Tenant-Id`); este test cubre el evento
 * de auditoría `TENANT_IMPERSONATED` (actor y cliente) y que solo lo pueda
 * disparar personal de plataforma: ADMIN y SUPPORT, nunca un usuario de cliente.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createDepartment,
  createTenant,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

const db = async () => (await import("@core/config/database")).prismaClient;

interface AuditRow {
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userName: string | null;
  tenantId: string | null;
  metadata: { tenantId?: string; slug?: string; name?: string } | null;
}

const impersonations = async (): Promise<AuditRow[]> => {
  const client = await db();
  return (await client.auditLog.findMany({
    where: { action: "TENANT_IMPERSONATED" },
    orderBy: { createdAt: "asc" },
  })) as unknown as AuditRow[];
};

let admin: Session;
let support: Session;
let tenant: TenantFixture;
let clientAdmin: Session;

before(async () => {
  await setupSuite();
  admin = await platformSession("ADMIN");
  support = await platformSession("SUPPORT");
  tenant = await createTenant();
  clientAdmin = await clientSession("CLIENT_ADMIN", { tenant });
});

after(async () => {
  await stopSuite();
});

describe("entrar como cliente (F3-03)", () => {
  test("un ADMIN de plataforma entra al cliente y queda auditado con actor y tenant", async () => {
    const response = await api("POST", `/tenants/${tenant.id}/impersonate`, {
      token: admin.token,
    });
    expectStatus(response, 200, "entrar como cliente (ADMIN)");
    assert.equal(response.body?.id, tenant.id);
    assert.equal(response.body?.slug, tenant.slug);

    const rows = await impersonations();
    const row = rows.find((entry) => entry.userId === admin.user.id);
    assert.ok(row, "debe existir el evento TENANT_IMPERSONATED del ADMIN");
    assert.equal(row.entityType, "Tenant");
    assert.equal(row.entityId, tenant.id);
    assert.equal(row.userName, admin.user.username);
    assert.equal(row.tenantId, null, "la bitácora de plataforma va sin cliente");
    assert.equal(row.metadata?.tenantId, tenant.id);
    assert.equal(row.metadata?.slug, tenant.slug);
  });

  test("un SUPPORT (solo tenants.view) también entra y queda auditado", async () => {
    const response = await api("POST", `/tenants/${tenant.id}/impersonate`, {
      token: support.token,
    });
    expectStatus(response, 200, "entrar como cliente (SUPPORT)");

    const rows = await impersonations();
    const row = rows.find((entry) => entry.userId === support.user.id);
    assert.ok(row, "debe existir el evento TENANT_IMPERSONATED del SUPPORT");
    assert.equal(row.entityId, tenant.id);
    assert.equal(row.metadata?.slug, tenant.slug);
  });

  test("un usuario de cliente no puede entrar como otro cliente", async () => {
    const before = (await impersonations()).length;
    const response = await api("POST", `/tenants/${tenant.id}/impersonate`, {
      token: clientAdmin.token,
    });
    expectError(response, 403, "INSUFFICIENT_PERMISSIONS", "impersonación desde cliente");
    assert.equal((await impersonations()).length, before, "no se audita un intento denegado");
  });

  test("no se audita un cliente inexistente ni uno suspendido", async () => {
    const before = (await impersonations()).length;

    const missing = await api("POST", `/tenants/${unique("no-existe")}/impersonate`, {
      token: admin.token,
    });
    expectError(missing, 404, "TENANT_NOT_FOUND", "cliente inexistente");

    const suspended = await createTenant({ status: "SUSPENDED" });
    const inactive = await api("POST", `/tenants/${suspended.id}/impersonate`, {
      token: admin.token,
    });
    expectError(inactive, 400, "INVALID_TENANT_HEADER", "cliente suspendido");

    assert.equal((await impersonations()).length, before, "no se audita lo que no se puede operar");
  });

  test("tras impersonar, la operación sigue siendo por X-Tenant-Id", async () => {
    const department = await createDepartment(tenant.id, unique("SOPORTE"));

    const response = await api("GET", "/departments", {
      token: support.token,
      tenantId: tenant.id,
    });
    expectStatus(response, 200, "operar como el cliente con X-Tenant-Id");
    const ids = (response.body as unknown as Array<{ id: string }>).map((row) => row.id);
    assert.ok(ids.includes(department.id), "el soporte ve los datos del cliente elegido");
  });
});
