/**
 * Aislamiento entre clientes (tenancy): CRUD ajeno, X-Tenant-Id de plataforma y
 * regresión de las consultas `$queryRaw` que se saltan la extensión de Prisma
 * (tabla de empleados del reloj y nombres del reporte de checadas).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createDepartment,
  createPunch,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
  type UserFixture,
} from "./harness";

const REPORT_TZ = "America/Mexico_City";

/** Día local del instante en la zona del reporte (`YYYY-MM-DD`). */
const localDayKey = (instant: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

// El reloj de B repite el MISMO número que el de A: es justo el caso en el que
// una consulta sin predicado de cliente mezcla nombres entre clientes.
const A_NUMBER = "A-EMP-01";
const B_NUMBER = "B-EMP-99";
const SHARED_NUMBER = "777001";
const reportPunchAt = new Date(Date.now() - 10 * 60 * 1000);
const reportPunchLater = new Date(reportPunchAt.getTime() + 5 * 60 * 1000);

let tenantA: TenantFixture;
let tenantB: TenantFixture;
let adminA: Session;
let adminB: Session;
let platform: Session;
let deptA: { id: string; name: string };
let deptB: { id: string; name: string };
let staffA: UserFixture;
let staffB: UserFixture;

before(async () => {
  await setupSuite();
  tenantA = await createTenant();
  tenantB = await createTenant();
  adminA = await clientSession("CLIENT_ADMIN", { tenant: tenantA });
  adminB = await clientSession("CLIENT_ADMIN", { tenant: tenantB });
  platform = await platformSession("ADMIN");
  deptA = await createDepartment(tenantA.id, unique("RH-A"));
  deptB = await createDepartment(tenantB.id, unique("RH-B"));
  staffA = await createUser({ tenantId: tenantA.id, role: "CLIENT_STAFF", username: unique("staff-a") });
  staffB = await createUser({ tenantId: tenantB.id, role: "CLIENT_STAFF", username: unique("staff-b") });
  await createPunch(tenantA.id, { employeeNumber: A_NUMBER, name: "ANA DE A" });
  await createPunch(tenantB.id, { employeeNumber: B_NUMBER, name: "BRUNO DE B" });
  await createPunch(tenantA.id, {
    employeeNumber: SHARED_NUMBER,
    name: "ANA REPORTE",
    occurredAt: reportPunchAt,
  });
  await createPunch(tenantB.id, {
    employeeNumber: SHARED_NUMBER,
    name: "BRUNO REPORTE",
    occurredAt: reportPunchLater,
  });
});

after(async () => {
  await stopSuite();
});

describe("aislamiento CRUD entre clientes", () => {
  test("el admin de A no lista a los usuarios de B", async () => {
    const response = await api("GET", "/users", { token: adminA.token });
    expectStatus(response, 200, "listado de usuarios de A");
    const list = response.body as unknown as Array<{ id: string; username: string }>;
    assert.ok(list.some((user) => user.id === staffA.id), "A debe ver a sus propios usuarios");
    assert.ok(list.some((user) => user.id === adminA.user.id), "A debe ver a sus propios usuarios");
    assert.ok(!list.some((user) => user.id === staffB.id), "A no debe listar al usuario de B");
    assert.ok(!response.text.includes(staffB.username), "A no debe ver el username de B");
  });

  test("el admin de A no lee, edita ni borra el usuario de B por id", async () => {
    const read = await api("GET", `/users/${staffB.id}`, { token: adminA.token });
    expectError(read, 404, "RECORD_NOT_FOUND", "lectura del usuario de B");

    const update = await api("PUT", `/users/${staffB.id}`, {
      token: adminA.token,
      body: { name: "HACKEADO" },
    });
    expectError(update, 404, "RECORD_NOT_FOUND", "edición del usuario de B");

    const remove = await api("DELETE", `/users/${staffB.id}`, { token: adminA.token });
    expectError(remove, 404, "USER_NOT_FOUND", "baja del usuario de B");

    const stillThere = await api("GET", `/users/${staffB.id}`, { token: adminB.token });
    expectStatus(stillThere, 200, "el usuario de B sigue intacto");
  });

  test("el admin de A no lista los departamentos de B", async () => {
    const response = await api("GET", "/departments", { token: adminA.token });
    expectStatus(response, 200, "listado de departamentos de A");
    const list = response.body as unknown as Array<{ id: string; name: string }>;
    assert.ok(list.some((department) => department.id === deptA.id), "A debe ver sus departamentos");
    assert.ok(!list.some((department) => department.id === deptB.id), "A no debe ver el departamento de B");
  });

  test("el admin de A no lee, edita ni borra el departamento de B por id", async () => {
    const read = await api("GET", `/departments/${deptB.id}`, { token: adminA.token });
    expectError(read, 404, "DEPARTMENT_NOT_FOUND", "lectura del departamento de B");

    const update = await api("PUT", `/departments/${deptB.id}`, {
      token: adminA.token,
      body: { name: unique("X") },
    });
    expectError(update, 404, "RECORD_NOT_FOUND", "edición del departamento de B");

    const remove = await api("DELETE", `/departments/${deptB.id}`, { token: adminA.token });
    expectError(remove, 404, "DEPARTMENT_NOT_FOUND", "baja del departamento de B");

    const stillThere = await api("GET", `/departments/${deptB.id}`, { token: adminB.token });
    expectStatus(stillThere, 200, "el departamento de B sigue intacto");
  });

  test("lo que crea A no aparece en B", async () => {
    const created = await api("POST", "/departments", {
      token: adminA.token,
      body: { name: unique("OPS-A") },
    });
    expectStatus(created, 201, "alta de departamento en A");

    const listB = await api("GET", "/departments", { token: adminB.token });
    expectStatus(listB, 200, "listado de departamentos de B");
    const ids = (listB.body as unknown as Array<{ id: string }>).map((department) => department.id);
    assert.ok(!ids.includes(created.body!.id), "el departamento nuevo de A no debe aparecer en B");
  });
});

describe("X-Tenant-Id", () => {
  test("un usuario de cliente que manda el header recibe 403", async () => {
    const departments = await api("GET", "/departments", {
      token: adminA.token,
      tenantId: tenantB.id,
    });
    expectError(departments, 403, "TENANT_HEADER_FORBIDDEN", "header desde usuario de cliente");

    const punches = await api("POST", "/time-clock/employees/query", {
      token: adminA.token,
      tenantId: tenantB.id,
      body: { page: 1, limit: 10 },
    });
    expectError(punches, 403, "TENANT_HEADER_FORBIDDEN", "header desde usuario de cliente (checadas)");
  });

  test("el ADMIN de plataforma elige cliente con el header y ve los datos de ese cliente", async () => {
    const response = await api("GET", "/departments", {
      token: platform.token,
      tenantId: tenantB.id,
    });
    expectStatus(response, 200, "departamentos del cliente elegido");
    const names = (response.body as unknown as Array<{ name: string }>).map(
      (department) => department.name
    );
    assert.ok(names.includes(deptB.name), "el ADMIN debe ver los departamentos de B");
    assert.ok(!names.includes(deptA.name), "el ADMIN no debe ver los departamentos de A");
  });

  test("sin header, el ADMIN de plataforma ve el barrido global", async () => {
    const response = await api("GET", "/departments", { token: platform.token });
    expectStatus(response, 200, "departamentos sin cliente elegido");
    const names = (response.body as unknown as Array<{ name: string }>).map(
      (department) => department.name
    );
    assert.ok(names.includes(deptA.name), "sin contexto no se filtra: aparece A");
    assert.ok(names.includes(deptB.name), "sin contexto no se filtra: aparece B");
  });

  test("un X-Tenant-Id de un cliente inexistente se rechaza", async () => {
    const response = await api("GET", "/departments", {
      token: platform.token,
      tenantId: unique("no-existe"),
    });
    expectError(response, 400, "INVALID_TENANT_HEADER", "header con cliente inexistente");
  });
});

describe("fuga de las consultas $queryRaw", () => {
  test("A no ve las checadas de B en /time-clock/employees/query", async () => {
    const response = await api("POST", "/time-clock/employees/query", {
      token: adminA.token,
      body: { page: 1, limit: 50 },
    });
    expectStatus(response, 200, "empleados del reloj de A");
    const numbers = (response.body as unknown as { data: Array<{ employeeNumber: string }> }).data.map(
      (row) => row.employeeNumber
    );
    assert.ok(numbers.includes(A_NUMBER), "A debe ver sus propios empleados");
    assert.ok(!numbers.includes(B_NUMBER), "A no debe ver el número de B");
    assert.ok(!response.text.includes(B_NUMBER), "la respuesta de A no debe traer datos de B");
    assert.ok(!response.text.includes("BRUNO"), "A no debe ver nombres del reloj de B");
    assert.ok(
      numbers.every((number) => number === A_NUMBER || number === SHARED_NUMBER),
      `solo deben salir los números de A, no: ${numbers.join(", ")}`
    );
  });

  test("el ADMIN de plataforma con X-Tenant-Id=B solo ve las checadas de B", async () => {
    const response = await api("POST", "/time-clock/employees/query", {
      token: platform.token,
      tenantId: tenantB.id,
      body: { page: 1, limit: 50 },
    });
    expectStatus(response, 200, "empleados del reloj del cliente elegido");
    const numbers = (response.body as unknown as { data: Array<{ employeeNumber: string }> }).data.map(
      (row) => row.employeeNumber
    );
    assert.ok(numbers.includes(B_NUMBER), "el ADMIN debe ver los empleados de B");
    assert.ok(!numbers.includes(A_NUMBER), "el ADMIN no debe ver los empleados de A");
    assert.ok(response.text.includes("BRUNO DE B"), "el ADMIN debe ver los nombres de B");
    assert.ok(!response.text.includes("ANA"), "el ADMIN no debe ver nombres de A");
  });

  test("sin contexto (workers) se conserva el barrido global explícito", async () => {
    const { prismaClient } = await import("@core/config/database");
    const { TimeClockEmployeesService } = await import(
      "@modules/time-clock/services/time-clock-employees.service"
    );
    const service = new TimeClockEmployeesService(prismaClient);
    const result = await service.table({ page: 1, limit: 100, filters: {} });
    const numbers = result.data.map((row) => row.employeeNumber);
    assert.ok(numbers.includes(A_NUMBER) && numbers.includes(B_NUMBER), "sin contexto se ven ambos clientes");
  });

  test("el reporte de A no toma el nombre de las checadas de B", async () => {
    const response = await api("POST", "/time-clock/report", {
      token: adminA.token,
      body: {
        page: 1,
        limit: 100,
        filters: { period: "DAY", date: localDayKey(reportPunchAt), tz: REPORT_TZ },
      },
    });
    expectStatus(response, 200, "reporte de checadas de A");
    assert.ok(response.text.includes("ANA REPORTE"), "el reporte debe usar el nombre del reloj de A");
    assert.ok(!response.text.includes("BRUNO REPORTE"), "el reporte no debe usar el nombre del reloj de B");
  });
});
