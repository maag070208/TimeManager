/**
 * Integración de horarios: alta/listado/activación y reglas de asignación.
 *
 * Regla clave: una persona tiene UNA sola asignación vigente; asignar otro
 * horario cierra la vigencia anterior (no la borra) y quitar también cierra la
 * vigencia para conservar historial. Cubre SCH-01, SCH-02, SCH-04, SCH-M01,
 * SCH-M02, SCH-M03, ACT-21, ACT-22 y ACT-23.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
  type UserFixture,
} from "./harness";

let tenant: TenantFixture;
let admin: Session;
let employee: UserFixture;
let scheduleA: string;
let scheduleB: string;

const dayOf = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

const weekDays = (start: string, end: string) => [
  { weekday: 1, startTime: start, endTime: end, restDay: false },
  { weekday: 2, startTime: start, endTime: end, restDay: false },
  { weekday: 3, startTime: start, endTime: end, restDay: false },
  { weekday: 4, startTime: start, endTime: end, restDay: false },
  { weekday: 5, startTime: start, endTime: end, restDay: false },
];

const createSchedule = (name: string, start = "09:00", end = "17:00") =>
  api("POST", "/schedules", {
    token: admin.token,
    body: { name, entryToleranceMin: 10, exitToleranceMin: 0, mealBreakMin: 60, days: weekDays(start, end) },
  });

const assign = (scheduleId: string, from: string) =>
  api("POST", "/schedules/assignments", {
    token: admin.token,
    body: { scheduleId, userIds: [employee.id], from },
  });

const db = async () => (await import("@core/config/database")).prismaClient;

const assignmentsOf = async () => {
  const client = await db();
  const { runWithTenant } = await import("@core/tenancy");
  return runWithTenant(tenant.id, () =>
    client.scheduleAssignment.findMany({
      where: { userId: employee.id },
      orderBy: { validFrom: "asc" },
      select: { id: true, scheduleId: true, validFrom: true, validTo: true },
    })
  );
};

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF", username: unique("turno") });

  const a = await createSchedule(unique("Matutino"));
  expectStatus(a, 201, "alta de horario A");
  scheduleA = String(a.body?.id);
  const b = await createSchedule(unique("Vespertino"), "14:00", "22:00");
  expectStatus(b, 201, "alta de horario B");
  scheduleB = String(b.body?.id);
});

after(async () => {
  await stopSuite();
});

describe("horarios: alta y disponibilidad", () => {
  test("[SCH-01][SCH-02][SCH-M01][ACT-21] crear un horario de 7 días y listarlo", async () => {
    const allDays = Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      startTime: "08:00",
      endTime: "16:00",
      restDay: i >= 5,
    }));
    const created = await api("POST", "/schedules", {
      token: admin.token,
      body: { name: unique("Semanal"), mealBreakMin: 60, minOvertimeMin: 30, days: allDays },
    });
    expectStatus(created, 201, "alta de horario de 7 días");
    assert.equal((created.body?.days ?? []).length, 7);

    const list = await api("GET", "/schedules?includeInactive=true", { token: admin.token });
    expectStatus(list, 200, "GET /schedules");
    const schedules = (list.body ?? []) as Array<{ id: string }>;
    assert.ok(schedules.some((s) => s.id === created.body?.id), "el horario nuevo aparece en la lista");
  });

  test("[SCH-M02][ACT-22] un horario inactivo no se puede asignar", async () => {
    const off = await api("PATCH", `/schedules/${scheduleA}`, {
      token: admin.token,
      body: { active: false },
    });
    expectStatus(off, 200, "desactivar horario");
    assert.equal(off.body?.active, false);

    const rejected = await assign(scheduleA, "2026-11-02");
    expectError(rejected, 400, "INVALID_SCHEDULE", "asignar un horario inactivo");

    const on = await api("PATCH", `/schedules/${scheduleA}`, {
      token: admin.token,
      body: { active: true },
    });
    expectStatus(on, 200, "reactivar horario");
    assert.equal(on.body?.active, true);
  });
});

describe("asignación de horario: una sola vigencia", () => {
  test("[SCH-04][SCH-M03][ACT-23] asignar reemplaza: cierra la vigencia previa", async () => {
    const first = await assign(scheduleA, "2026-11-02");
    expectStatus(first, 201, "asignar horario A");
    assert.equal(first.body?.assigned, 1);

    const second = await assign(scheduleB, "2026-11-16");
    expectStatus(second, 201, "asignar horario B (reemplazo)");

    const rows = await assignmentsOf();
    const active = rows.filter((row) => row.validTo === null);
    assert.equal(active.length, 1, "solo debe quedar una asignación vigente");
    assert.equal(active[0].scheduleId, scheduleB);
    const previous = rows.find((row) => row.scheduleId === scheduleA);
    assert.ok(previous, "la vigencia anterior no se borra");
    assert.ok(previous!.validTo, "la vigencia anterior se cierra");
    assert.equal(previous!.validTo!.getTime(), dayOf("2026-11-15").getTime(), "cierra el día anterior al nuevo inicio");

    const assignees = await api("GET", `/schedules/${scheduleB}/assignees`, { token: admin.token });
    expectStatus(assignees, 200, "GET assignees");
    assert.ok((assignees.body ?? []).some((a: { userId: string }) => a.userId === employee.id));
  });

  test("[SCH-04][ACT-23] reasignar con el mismo inicio también deja una sola vigente", async () => {
    const replacement = await assign(scheduleA, "2026-11-16");
    expectStatus(replacement, 201, "reasignar A en el mismo inicio");
    const rows = await assignmentsOf();
    const active = rows.filter((row) => row.validTo === null);
    assert.equal(active.length, 1, "una sola vigente aunque el inicio sea el mismo");
    assert.equal(active[0].scheduleId, scheduleA);
    const bRows = rows.filter((row) => row.scheduleId === scheduleB && row.validTo === null);
    assert.equal(bRows.length, 0, "B quedó cerrado");
  });

  test("[SCH-04][ACT-23] quitar cierra la vigencia y conserva el historial", async () => {
    const before = await assignmentsOf();
    assert.ok(before.some((row) => row.validTo === null), "hay una vigente antes de quitar");

    const removed = await api("POST", "/schedules/assignments/remove", {
      token: admin.token,
      body: { scheduleId: scheduleA, userIds: [employee.id] },
    });
    expectStatus(removed, 200, "quitar asignación");
    assert.equal(removed.body?.removed, 1);

    const rows = await assignmentsOf();
    assert.equal(rows.filter((row) => row.validTo === null).length, 0, "no queda vigente");
    assert.ok(rows.length >= 2, "el historial de asignaciones se conserva");
    const open = await api("POST", "/schedules/assignments/query", {
      token: admin.token,
      body: { page: 1, limit: 50 },
    });
    expectStatus(open, 200, "assignments/query");
    assert.equal(open.body?.total, 0, "la tabla de vigentes queda vacía");
  });

});
