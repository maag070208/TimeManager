/**
 * Personal (cuentas) y roles: alta → listado → edición → baja → reactivación,
 * el guard del directorio de personas que alimenta los selectores de la web y
 * la regla que impide dar roles de plataforma a personal de un cliente.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PASSWORD,
  api,
  clientSession,
  createDepartment,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  login,
  platformSession,
  setupSuite,
  stopSuite,
  unique,
} from "./harness";

const prismaClient = async () =>
  (await import("@core/config/database")).prismaClient;

/** Excepción de permiso por empleado (la que administra la consola de roles). */
const grantPermission = async (userId: string, permission: string): Promise<void> => {
  const client = await prismaClient();
  await client.userPermission.create({ data: { userId, permission, scope: "ALL" } });
};

const accountBody = (overrides: Record<string, unknown> = {}) => ({
  username: unique("emp"),
  password: DEFAULT_PASSWORD,
  name: "Ana",
  maternalSurname: "Ruiz",
  role: "CLIENT_STAFF",
  ...overrides,
});

const rowsOf = (body: unknown): Array<Record<string, any>> =>
  Array.isArray(body) ? (body as Array<Record<string, any>>) : [];

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("Personal: alta, listado, edición, baja y reactivación", () => {
  test("CLIENT_ADMIN crea una cuenta y aparece en la lista de Personal", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const body = accountBody({ jobTitle: "Analista de nómina" });

    const created = await api("POST", "/users", { token: admin.token, body });
    expectStatus(created, 201, "alta de cuenta");
    assert.equal(created.body?.username, body.username);
    assert.equal(created.body?.role, "CLIENT_STAFF");
    assert.equal(created.body?.active, true);
    assert.ok(created.body?.id, "la cuenta creada trae id");

    const table = await api("POST", "/users/query", {
      token: admin.token,
      body: { page: 1, limit: 50, filters: { username: body.username } },
    });
    expectStatus(table, 200, "lista de Personal");
    const row = rowsOf(table.body?.data).find((user) => user.id === created.body?.id);
    assert.ok(row, "la cuenta nueva aparece en POST /users/query");
    assert.equal(row.active, true);
    assert.equal(row.jobTitle, "Analista de nómina");
  });

  test("la cuenta se edita (puesto y departamento) y el cambio persiste", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const department = await createDepartment(tenant.id, "Nómina");
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const updated = await api("PUT", `/users/${user.id}`, {
      token: admin.token,
      body: {
        name: "Ana Luisa",
        jobTitle: "Coordinadora de nómina",
        departmentId: department.id,
      },
    });
    expectStatus(updated, 200, "edición de cuenta");
    assert.equal(updated.body?.jobTitle, "Coordinadora de nómina");
    // La respuesta de PUT trae `departmentId` (la ficha con `department` es la del GET).
    assert.equal(updated.body?.departmentId, department.id);

    const fetched = await api("GET", `/users/${user.id}`, { token: admin.token });
    expectStatus(fetched, 200, "lectura de la cuenta editada");
    assert.equal(fetched.body?.name, "Ana Luisa");
    assert.equal(fetched.body?.department?.id, department.id);
  });

  test("la baja saca la cuenta del directorio y del login; reactivar la devuelve", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const body = accountBody();
    const created = await api("POST", "/users", { token: admin.token, body });
    expectStatus(created, 201, "alta para la baja");
    const id = created.body?.id as string;

    const down = await api("PATCH", `/users/${id}/deactivate`, {
      token: admin.token,
      body: { reason: "Baja voluntaria de prueba", notifyUser: false },
    });
    expectStatus(down, 200, "baja de cuenta");
    assert.equal(down.body?.active, false);
    assert.ok(down.body?.deactivatedAt, "la baja registra la fecha");

    const blocked = await api("POST", "/auth/login", {
      body: { username: body.username, password: DEFAULT_PASSWORD, tenant: tenant.slug },
    });
    expectError(blocked, 403, "ACCOUNT_DEACTIVATED", "login tras la baja");

    const directory = await api("GET", "/users/employees", { token: admin.token });
    expectStatus(directory, 200, "directorio tras la baja");
    assert.ok(
      !rowsOf(directory.body).some((user) => user.id === id),
      "una cuenta dada de baja no aparece en el directorio activo"
    );

    const up = await api("PATCH", `/users/${id}/reactivate`, { token: admin.token });
    expectStatus(up, 200, "reactivación de cuenta");
    assert.equal(up.body?.active, true);
    assert.equal(up.body?.deactivatedAt, null);

    await login({ username: body.username, tenant: tenant.slug });

    const back = await api("GET", "/users/employees", { token: admin.token });
    expectStatus(back, 200, "directorio tras la reactivación");
    assert.ok(
      rowsOf(back.body).some((user) => user.id === id),
      "la cuenta reactivada vuelve al directorio"
    );
  });
});

describe("Directorio /users/employees: guard por permiso", () => {
  test("CLIENT_STAFF sin permisos recibe 403", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    const directory = await api("GET", "/users/employees", { token: staff.token });
    expectError(directory, 403, "INSUFFICIENT_PERMISSIONS", "staff sin permisos");
  });

  test("CLIENT_ADMIN lista su directorio y no filtra el de otro cliente", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const own = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const otherTenant = await createTenant();
    const foreign = await createUser({ tenantId: otherTenant.id, role: "CLIENT_STAFF" });

    const directory = await api("GET", "/users/employees", { token: admin.token });
    expectStatus(directory, 200, "directorio del CLIENT_ADMIN");
    const users = rowsOf(directory.body);
    assert.ok(users.length > 0, "el directorio propio no viene vacío");
    assert.ok(users.some((user) => user.id === own.id), "incluye a su personal");
    assert.ok(
      !users.some((user) => user.id === foreign.id),
      "no expone personal de otro cliente"
    );
    const sample = users[0];
    assert.equal(typeof sample.id, "string");
    assert.equal(typeof sample.username, "string");
    assert.equal(typeof sample.role, "string");
  });

  test("HUMAN_RESOURCES (hr.records) conserva el selector de reportes de RH", async () => {
    const hr = await clientSession("HUMAN_RESOURCES");
    const directory = await api("GET", "/users/employees", { token: hr.token });
    expectStatus(directory, 200, "directorio de RH");
    assert.ok(Array.isArray(directory.body), "la respuesta sigue siendo un arreglo");
  });

  test("una excepción de schedules.view abre el selector de asignación de horarios", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    await grantPermission(staff.user.id, "schedules.view");
    const directory = await api("GET", "/users/employees", { token: staff.token });
    expectStatus(directory, 200, "directorio con schedules.view");
  });

  test("una excepción de time_clock.view abre el selector del personal del reloj", async () => {
    const tenant = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    await grantPermission(staff.user.id, "time_clock.view");
    const directory = await api("GET", "/users/employees", { token: staff.token });
    expectStatus(directory, 200, "directorio con time_clock.view");
  });
});

describe("Regresión: roles de plataforma fuera del alcance de los clientes", () => {
  test("CLIENT_ADMIN no puede dar el rol ADMIN al crear", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const created = await api("POST", "/users", {
      token: admin.token,
      body: accountBody({ role: "ADMIN" }),
    });
    expectError(created, 403, "ROLE_NOT_FOR_CLIENT", "alta con rol ADMIN");
  });

  test("CLIENT_ADMIN no puede esconder SUPPORT entre los roles adicionales", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    const created = await api("POST", "/users", {
      token: admin.token,
      body: accountBody({ role: "CLIENT_STAFF", roles: ["SUPPORT"] }),
    });
    expectError(created, 403, "ROLE_NOT_FOR_CLIENT", "alta con extraRole SUPPORT");
  });

  test("editar a alguien del propio cliente y subirlo a ADMIN se rechaza", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const target = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const updated = await api("PUT", `/users/${target.id}`, {
      token: admin.token,
      body: { role: "ADMIN" },
    });
    expectError(updated, 403, "ROLE_NOT_FOR_CLIENT", "edición a ADMIN");

    const fetched = await api("GET", `/users/${target.id}`, { token: admin.token });
    expectStatus(fetched, 200, "lectura tras el intento de escalada");
    assert.equal(fetched.body?.role, "CLIENT_STAFF", "el rol no cambió");
  });

  test("plataforma sin cliente elegido tampoco vuelve ADMIN a alguien de un cliente", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const target = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const updated = await api("PUT", `/users/${target.id}`, {
      token: platform.token,
      body: { role: "ADMIN" },
    });
    expectError(updated, 403, "ROLE_NOT_FOR_CLIENT", "edición de plataforma sin cliente");
  });

  test("la consola de roles no deja asignar ADMIN a un usuario de cliente", async () => {
    const platform = await platformSession("ADMIN");
    const tenant = await createTenant();
    const target = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const granted = await api("PUT", `/permissions/roles/ADMIN/members/${target.id}`, {
      token: platform.token,
      tenantId: tenant.id,
    });
    expectError(granted, 403, "ROLE_NOT_FOR_CLIENT", "consola de roles: ADMIN a cliente");
  });

  test("CLIENT_ADMIN no entra a la consola de roles", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const target = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const granted = await api("PUT", `/permissions/roles/ADMIN/members/${target.id}`, {
      token: admin.token,
    });
    expectError(granted, 403, "INSUFFICIENT_PERMISSIONS", "consola de roles sin roles.manage");
  });

  test("los roles de cliente válidos se siguen aceptando al crear", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });

    for (const role of ["CLIENT_ADMIN", "HUMAN_RESOURCES", "CLIENT_STAFF"]) {
      const created = await api("POST", "/users", {
        token: admin.token,
        body: accountBody({ role }),
      });
      expectStatus(created, 201, `alta con rol ${role}`);
      assert.equal(created.body?.role, role);
    }
  });

  test("plataforma sin cliente sí puede crear un ADMIN de plataforma", async () => {
    const platform = await platformSession("ADMIN");
    const username = unique("plat");

    const created = await api("POST", "/users", {
      token: platform.token,
      body: { username, password: DEFAULT_PASSWORD, name: "Admin de plataforma", role: "ADMIN" },
    });
    expectStatus(created, 201, "alta de ADMIN de plataforma");
    assert.equal(created.body?.role, "ADMIN");

    await login({ username });
  });
});
