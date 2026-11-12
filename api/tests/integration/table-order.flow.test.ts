/**
 * Orden por defecto de las tablas: lo más reciente primero.
 *
 * Regla del usuario: toda tabla con fecha arranca en descendente (reciente →
 * antiguo). Aquí se cubren los listados que se pintan como tabla en la web y
 * que no van por `POST /query` (checadas, vacaciones, tiempo extra y
 * teletrabajo), además de la tabla de checadas como regresión del fallback
 * `occurredAt desc`.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createPunch,
  createTenant,
  createUser,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

let tenant: TenantFixture;
let admin: Session;
let staff: Session;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** La lista va de más reciente a más antiguo en la clave de fecha indicada. */
const expectDescending = (rows: Array<Record<string, unknown>>, key: string, label: string) => {
  assert.ok(rows.length > 0, `${label}: la lista no puede venir vacía`);
  for (let i = 1; i < rows.length; i += 1) {
    const previous = new Date(String(rows[i - 1][key])).getTime();
    const current = new Date(String(rows[i][key])).getTime();
    assert.ok(previous >= current, `${label}: ${key} debe venir de más reciente a más antiguo (fila ${i})`);
  }
};

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  staff = await clientSession("CLIENT_STAFF", { tenant });
});

after(async () => {
  await stopSuite();
});

describe("orden por defecto reciente → antiguo", () => {
  test("checadas: la tabla arranca por occurredAt descendente", async () => {
    const employeeNumber = unique("ORDEN");
    const base = new Date("2026-11-02T15:00:00.000Z").getTime();
    for (let i = 0; i < 3; i += 1) {
      await createPunch(tenant.id, {
        employeeNumber,
        name: "PERSONA ORDEN",
        serialNo: 500 + i,
        occurredAt: new Date(base + i * 60_000),
      });
    }

    const table = await api("POST", "/time-clock/query", {
      token: admin.token,
      body: { page: 1, limit: 10, filters: { employeeNumber } },
    });
    expectStatus(table, 200, "tabla de checadas");
    const rows = (table.body?.data ?? []) as Array<Record<string, unknown>>;
    assert.equal(rows.length, 3);
    assert.equal(new Date(String(rows[0].occurredAt)).getTime(), base + 2 * 60_000);
    expectDescending(rows, "occurredAt", "checadas");
  });

  test("vacaciones: RH lista la solicitud con la fecha más reciente primero", async () => {
    const types = await api("GET", "/nom/leave/types", { token: admin.token });
    expectStatus(types, 200, "tipos de permiso");
    const vacation = (types.body as Array<Record<string, unknown>>).find((row) => row.key === "VACACIONES");
    assert.ok(vacation, "existe el tipo VACACIONES");

    const db = (await import("@core/config/database")).prismaClient;
    await db.user.update({ where: { id: staff.user.id }, data: { hireDate: new Date("2020-01-15T00:00:00.000Z") } });

    const ensure = async (startDate: string, endDate: string) => {
      const created = await api("POST", "/nom/me/leave/requests", {
        token: staff.token,
        body: { typeId: vacation.id, startDate, endDate, reason: "Prueba de orden" },
      });
      expectStatus(created, 201, `solicitud ${startDate}`);
      return created.body as Record<string, unknown>;
    };
    await ensure("2027-03-01", "2027-03-02");
    await ensure("2027-05-03", "2027-05-04");

    const list = await api("GET", "/nom/leave/requests", { token: admin.token });
    expectStatus(list, 200, "RH lista solicitudes");
    const rows = (list.body ?? []) as Array<Record<string, unknown>>;
    assert.equal(String(rows[0].startDate).slice(0, 10), "2027-05-03");
    expectDescending(rows, "startDate", "solicitudes de vacaciones");

    const pending = await api("GET", "/nom/leave/requests?status=PENDING", { token: admin.token });
    expectStatus(pending, 200, "RH lista pendientes");
    expectDescending((pending.body ?? []) as Array<Record<string, unknown>>, "startDate", "pendientes de vacaciones");
  });

  test("tiempo extra: RH lista la solicitud más reciente primero (sin agrupar por estado)", async () => {
    const first = await api("POST", "/nom/overtime/requests", {
      token: admin.token,
      body: { userId: staff.user.id, reason: "Cobertura de turno", plannedMin: 60, days: ["2027-03-08"] },
    });
    expectStatus(first, 201, "primera solicitud de tiempo extra");
    // `createdAt` se guarda con milisegundos: separa las dos capturas.
    await sleep(10);
    const second = await api("POST", "/nom/overtime/requests", {
      token: admin.token,
      body: { userId: staff.user.id, reason: "Cobertura de turno", plannedMin: 90, days: ["2027-03-09"] },
    });
    expectStatus(second, 201, "segunda solicitud de tiempo extra");

    const list = await api("GET", "/nom/overtime/requests", { token: admin.token });
    expectStatus(list, 200, "RH lista solicitudes de tiempo extra");
    const rows = (list.body ?? []) as Array<Record<string, unknown>>;
    assert.equal(rows[0]?.id, second.body?.id);
    expectDescending(rows, "createdAt", "solicitudes de tiempo extra");
  });

  test("teletrabajo: los registros arrancan por startedAt descendente", async () => {
    const other = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    const older = await api("POST", "/nom/telework/registrations", {
      token: admin.token,
      body: { userId: staff.user.id, mode: "REMOTO", startedAt: "2026-01-10" },
    });
    expectStatus(older, 201, "registro de teletrabajo antiguo");
    const newer = await api("POST", "/nom/telework/registrations", {
      token: admin.token,
      body: { userId: other.id, mode: "HIBRIDO", startedAt: "2026-06-15" },
    });
    expectStatus(newer, 201, "registro de teletrabajo reciente");

    const list = await api("GET", "/nom/telework/registrations", { token: admin.token });
    expectStatus(list, 200, "registros de teletrabajo");
    const rows = (list.body ?? []) as Array<Record<string, unknown>>;
    assert.equal(rows[0]?.id, newer.body?.id);
    expectDescending(rows, "startedAt", "registros de teletrabajo");
  });
});
