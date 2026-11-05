/**
 * Planes del SaaS (F3-09/10/11): catálogo administrable solo por plataforma,
 * asignación del plan en la ficha del cliente, y enforcement de los límites de
 * personal y relojes. La baja de plan nunca borra datos.
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
  platformSession,
  setupSuite,
  stopSuite,
  unique,
} from "./harness";

const prismaClient = async () => (await import("@core/config/database")).prismaClient;
const tenancy = async () => import("@core/tenancy/context");
const plans = async () => import("@core/plans");

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

const planBody = (overrides: Record<string, unknown> = {}) => ({
  key: unique("plan").toUpperCase().replace(/-/g, "_"),
  name: `Plan ${unique("p")}`,
  employeeLimit: 5,
  clockLimit: 2,
  monthlyPrice: 500,
  ...overrides,
});

const createPlan = async (token: string, overrides: Record<string, unknown> = {}) => {
  const response = await api("POST", "/plans", { token, body: planBody(overrides) });
  expectStatus(response, 201, "alta de plan");
  return response.body as Record<string, any>;
};

const tenantBody = (overrides: Record<string, unknown> = {}) => ({
  name: `Cliente ${unique("c")}`,
  slug: unique("cli"),
  admin: { name: "Admin del cliente", username: unique("admin") },
  ...overrides,
});

const assignPlan = async (
  platformToken: string,
  tenantId: string,
  planId: string | null
) => api("PATCH", `/tenants/${tenantId}`, { token: platformToken, body: { planId } });

describe("Catálogo de planes (solo plataforma)", () => {
  test("ADMIN crea, lista, edita y consulta un plan", async () => {
    const platform = await platformSession("ADMIN");
    const created = await createPlan(platform.token, {
      name: "Plan Equipo",
      employeeLimit: 25,
      clockLimit: 3,
      monthlyPrice: 250,
    });
    assert.equal(created.name, "Plan Equipo");
    assert.equal(created.employeeLimit, 25);
    assert.equal(created.clockLimit, 3);
    assert.equal(created.monthlyPrice, "250.00");
    assert.equal(created.active, true);

    const list = await api("GET", "/plans", { token: platform.token });
    expectStatus(list, 200, "lista de planes");
    assert.ok(
      (list.body as Array<Record<string, any>>).some((plan) => plan.id === created.id),
      "el plan nuevo aparece en el catálogo"
    );

    const updated = await api("PATCH", `/plans/${created.id}`, {
      token: platform.token,
      body: { name: "Plan Equipo Pro", employeeLimit: 30, clockLimit: 4, monthlyPrice: 300 },
    });
    expectStatus(updated, 200, "edición de plan");
    assert.equal(updated.body?.name, "Plan Equipo Pro");
    assert.equal(updated.body?.employeeLimit, 30);
    assert.equal(updated.body?.clockLimit, 4);
    assert.equal(updated.body?.monthlyPrice, "300.00");

    const one = await api("GET", `/plans/${created.id}`, { token: platform.token });
    expectStatus(one, 200, "consulta de plan");
    assert.equal(one.body?.name, "Plan Equipo Pro");
  });

  test("la clave duplicada responde 409 y sin clave se deriva del nombre", async () => {
    const platform = await platformSession("ADMIN");
    const key = unique("PLAN").toUpperCase().replace(/-/g, "_");
    await createPlan(platform.token, { key });

    const duplicated = await api("POST", "/plans", {
      token: platform.token,
      body: planBody({ key }),
    });
    expectError(duplicated, 409, "PLAN_KEY_TAKEN", "clave repetida");

    const derived = await api("POST", "/plans", {
      token: platform.token,
      body: {
        name: `Plan Director ${unique("x")}`,
        employeeLimit: 10,
        clockLimit: 1,
      },
    });
    expectStatus(derived, 201, "alta con clave derivada");
    assert.match(String(derived.body?.key), /^PLAN_DIRECTOR_/);
  });

  test("baja lógica: deja de listarse, el cliente la conserva y se puede reactivar", async () => {
    const platform = await platformSession("ADMIN");
    const plan = await createPlan(platform.token, { employeeLimit: 10, clockLimit: 1 });

    const down = await api("DELETE", `/plans/${plan.id}`, { token: platform.token });
    expectStatus(down, 200, "baja de plan");
    assert.equal(down.body?.active, false);

    const active = await api("GET", "/plans", { token: platform.token });
    expectStatus(active, 200, "catálogo activo");
    assert.ok(
      !(active.body as Array<Record<string, any>>).some((row) => row.id === plan.id),
      "un plan dado de baja no se ofrece"
    );

    const all = await api("GET", "/plans?includeInactive=true", { token: platform.token });
    expectStatus(all, 200, "catálogo con bajas");
    assert.ok((all.body as Array<Record<string, any>>).some((row) => row.id === plan.id));

    const up = await api("PATCH", `/plans/${plan.id}`, {
      token: platform.token,
      body: { active: true },
    });
    expectStatus(up, 200, "reactivación de plan");
    assert.equal(up.body?.active, true);
  });

  test("solo la plataforma entra: cliente 403, SUPPORT consulta pero no administra", async () => {
    const tenant = await createTenant();
    const client = await clientSession("CLIENT_ADMIN", { tenant });
    const support = await platformSession("SUPPORT");

    const clientRead = await api("GET", "/plans", { token: client.token });
    expectError(clientRead, 403, "INSUFFICIENT_PERMISSIONS", "cliente en el catálogo");

    const supportRead = await api("GET", "/plans", { token: support.token });
    expectStatus(supportRead, 200, "SUPPORT consulta el catálogo");

    const supportWrite = await api("POST", "/plans", {
      token: support.token,
      body: planBody(),
    });
    expectError(supportWrite, 403, "INSUFFICIENT_PERMISSIONS", "SUPPORT no administra planes");

    const anonymous = await api("GET", "/plans");
    expectError(anonymous, 401, "TOKEN_MISSING", "catálogo sin sesión");
  });
});

describe("Asignación del plan en la ficha del cliente", () => {
  test("PATCH /tenants/:id asigna el plan y la ficha trae uso y límites", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    await createUser({ tenantId: tenant.id, role: "CLIENT_ADMIN" });
    const plan = await createPlan(platform.token, { employeeLimit: 40, clockLimit: 2 });

    const assigned = await assignPlan(platform.token, tenant.id, plan.id);
    expectStatus(assigned, 200, "asignación de plan");
    assert.equal(assigned.body?.planId, plan.id);
    assert.equal(assigned.body?.plan?.id, plan.id);
    assert.equal(assigned.body?.plan?.key, plan.key);
    assert.deepEqual(assigned.body?.limits, { people: 40, clocks: 2 });
    assert.equal(assigned.body?.usage?.activeUsers, 1);
    assert.equal(assigned.body?.usage?.clocks, 0);
  });

  test("el alta de cliente acepta plan y su admin cabe en el límite", async () => {
    const platform = await platformSession("ADMIN");
    const plan = await createPlan(platform.token, { employeeLimit: 2, clockLimit: 1 });

    const created = await api("POST", "/tenants", {
      token: platform.token,
      body: tenantBody({ planId: plan.id }),
    });
    expectStatus(created, 201, "alta de cliente con plan");
    assert.equal(created.body?.tenant?.planId, plan.id);
    assert.equal(created.body?.tenant?.limits?.people, 2);
    assert.equal(created.body?.tenant?.usage?.activeUsers, 1);
  });

  test("plan inexistente 404 y plan inactivo 409 (alta y asignación)", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();

    const missing = await assignPlan(platform.token, tenant.id, "00000000-0000-4000-8000-000000000000");
    expectError(missing, 404, "PLAN_NOT_FOUND", "plan inexistente");

    const plan = await createPlan(platform.token, { employeeLimit: 5, clockLimit: 1 });
    await api("DELETE", `/plans/${plan.id}`, { token: platform.token });

    const inactive = await assignPlan(platform.token, tenant.id, plan.id);
    expectError(inactive, 409, "PLAN_INACTIVE", "plan inactivo en asignación");

    const onboarding = await api("POST", "/tenants", {
      token: platform.token,
      body: tenantBody({ planId: plan.id }),
    });
    expectError(onboarding, 409, "PLAN_INACTIVE", "plan inactivo en alta de cliente");
  });

  test("bajar de plan no borra nada: la ficha avisa uso por encima del límite", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    await createUser({ tenantId: tenant.id, role: "CLIENT_ADMIN" });
    await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const big = await createPlan(platform.token, { employeeLimit: 10, clockLimit: 3 });
    const small = await createPlan(platform.token, { employeeLimit: 1, clockLimit: 1 });

    await assignPlan(platform.token, tenant.id, big.id);
    const downgraded = await assignPlan(platform.token, tenant.id, small.id);
    expectStatus(downgraded, 200, "bajada de plan");
    assert.equal(downgraded.body?.plan?.id, small.id);
    assert.deepEqual(downgraded.body?.limits, { people: 1, clocks: 1 });
    assert.equal(downgraded.body?.usage?.activeUsers, 2);

    const client = await prismaClient();
    assert.equal(
      await client.user.count({ where: { tenantId: tenant.id, active: true } }),
      2,
      "los usuarios existentes no se tocan al bajar de plan"
    );
  });

  test("sin plan no se aplican límites", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const view = await api("GET", `/tenants/${tenant.id}`, { token: platform.token });
    expectStatus(view, 200, "ficha sin plan");
    assert.equal(view.body?.plan, null);
    assert.deepEqual(view.body?.limits, { people: null, clocks: null });
  });

  test("el override employeeLimit del cliente manda sobre el límite del plan", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const plan = await createPlan(platform.token, { employeeLimit: 100, clockLimit: 1 });

    const assigned = await assignPlan(platform.token, tenant.id, plan.id);
    expectStatus(assigned, 200, "asignación de plan");
    const overridden = await api("PATCH", `/tenants/${tenant.id}`, {
      token: platform.token,
      body: { employeeLimit: 3 },
    });
    expectStatus(overridden, 200, "override de límite");
    assert.deepEqual(overridden.body?.limits, { people: 3, clocks: 1 });
  });
});

describe("Enforcement: límite de personal", () => {
  test("el alta individual se bloquea al llegar al límite con uso y límite claros", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const plan = await createPlan(platform.token, { employeeLimit: 2, clockLimit: 1 });
    await assignPlan(platform.token, tenant.id, plan.id);

    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const first = await api("POST", "/users", {
      token: admin.token,
      body: { username: unique("emp"), password: DEFAULT_PASSWORD, name: "Primera Persona", role: "CLIENT_STAFF" },
    });
    expectStatus(first, 201, "alta hasta el límite");

    const blocked = await api("POST", "/users", {
      token: admin.token,
      body: { username: unique("emp"), password: DEFAULT_PASSWORD, name: "Segunda Persona", role: "CLIENT_STAFF" },
    });
    expectError(blocked, 409, "EMPLOYEE_LIMIT_REACHED", "alta por encima del límite");
    assert.match(String(blocked.body?.message), /2 personas activas/, "el mensaje trae el límite");
    assert.match(String(blocked.body?.message), /ya hay 2/, "el mensaje trae el uso");
  });

  test("dar de baja a una persona libera un lugar del plan", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const plan = await createPlan(platform.token, { employeeLimit: 2, clockLimit: 1 });
    await assignPlan(platform.token, tenant.id, plan.id);
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const first = await api("POST", "/users", {
      token: admin.token,
      body: { username: unique("emp"), password: DEFAULT_PASSWORD, name: "Baja Persona", role: "CLIENT_STAFF" },
    });
    expectStatus(first, 201, "alta hasta el límite");
    await api("POST", "/users", {
      token: admin.token,
      body: { username: unique("emp"), password: DEFAULT_PASSWORD, name: "Otra Persona", role: "CLIENT_STAFF" },
    });

    const down = await api("PATCH", `/users/${first.body?.id}/deactivate`, {
      token: admin.token,
      body: { reason: "Baja para liberar lugar", notifyUser: false },
    });
    expectStatus(down, 200, "baja de persona");

    const again = await api("POST", "/users", {
      token: admin.token,
      body: { username: unique("emp"), password: DEFAULT_PASSWORD, name: "Reemplazo", role: "CLIENT_STAFF" },
    });
    expectStatus(again, 201, "alta tras liberar lugar");
  });

  test("la importación se bloquea completa si el archivo no cabe en el plan", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const plan = await createPlan(platform.token, { employeeLimit: 2, clockLimit: 1 });
    await assignPlan(platform.token, tenant.id, plan.id);
    await clientSession("CLIENT_ADMIN", { tenant });
    await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const { runWithTenant } = await tenancy();
    const { UserImportService } = await import("@modules/users/services/user-import.service");
    const importer = new UserImportService();

    await runWithTenant(tenant.id, async () => {
      await assert.rejects(
        () =>
          importer.import([
            { name: "Import Uno", username: unique("imp"), password: DEFAULT_PASSWORD },
            { name: "Import Dos", username: unique("imp"), password: DEFAULT_PASSWORD },
          ]),
        (error: any) => error?.status === 409 && error?.code === "EMPLOYEE_LIMIT_REACHED",
        "la carga completa no cabe en el plan"
      );
    });

    const client = await prismaClient();
    assert.equal(
      await client.user.count({ where: { tenantId: tenant.id, active: true } }),
      2,
      "no se escribió ninguna fila de la carga rechazada"
    );
  });
});

describe("Enforcement: límite de relojes", () => {
  test("el alta de reloj se bloquea al llegar al límite del plan", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const plan = await createPlan(platform.token, { employeeLimit: 10, clockLimit: 1 });
    await assignPlan(platform.token, tenant.id, plan.id);

    const client = await prismaClient();
    const { runWithTenant } = await tenancy();
    const { assertCanAddClock } = await plans();

    await runWithTenant(tenant.id, async () => {
      await client.timeClock.create({
        data: { serialNumber: unique("SN"), url: "http://127.0.0.1:4801", name: "Reloj del cliente" },
      });

      await assert.rejects(
        () => assertCanAddClock(tenant.id),
        (error: any) => error?.status === 409 && error?.code === "CLOCK_LIMIT_REACHED",
        "el segundo reloj no cabe en el plan"
      );

      await client.timeClock.update({
        where: { serialNumber: (await client.timeClock.findFirstOrThrow({ where: { tenantId: tenant.id } })).serialNumber },
        data: { url: null },
      });
      await assertCanAddClock(tenant.id);
    });

    const view = await api("GET", `/tenants/${tenant.id}`, { token: platform.token });
    expectStatus(view, 200, "ficha con relojes");
    assert.equal(view.body?.usage?.clocks, 0, "un reloj dado de baja no ocupa lugar");
  });
});
