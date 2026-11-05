/**
 * F2-05 — retardo mal calculado (caso DEMO-911, "Retardo 5:59 h").
 *
 * El caso: Alberto Navarro entra 14:58 con un turno Vespertino 15:00 y la
 * pantalla le marca "Retardo 5:59 h". La causa era la resolución de la
 * asignación de horario: con dos asignaciones vigentes encimadas (una
 * corrección/reasignación hacia atrás que no cerró a la anterior) ganaba la
 * MÁS ANTIGUA, así que la checada de 14:58 se comparaba contra un Matutino
 * 09:00 → 359 min ≈ "5:59 h". Debe ganar la asignación que entró en vigor al
 * final (Vespertino 15:00) → 0 min.
 *
 * También fija que el retardo se reporta en minutos (5, no 5:59 h) y que un
 * día sin turno no inventa retardo.
 */
import { after, before, test } from "node:test";
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

const DAY = "2026-11-05"; // jueves, en CDMX
const CDMX = "America/Mexico_City";

/** 14:58:59 CDMX del jueves = 20:58:59Z (checada del ticket). */
const DEMO_ENTRY = new Date("2026-11-05T20:58:59.000Z");
/** 22:00 CDMX del jueves: salida dentro del Vespertino 15:00-23:00. */
const DEMO_EXIT = new Date("2026-11-06T04:00:00.000Z");

interface DayRow {
  date: string;
  entryAt: string | null;
  exitAt: string | null;
  lateMin: number;
  shift: string | null;
  status: string;
}
interface WeeklyRow {
  userId: string;
  name: string;
  scheduleName: string | null;
  linked: boolean;
  days: DayRow[];
}

let tenant: TenantFixture;
let admin: Session;
let demoEmployee: { id: string; employeeNumber: string; name: string };
let fiveMinEmployee: { id: string; employeeNumber: string; name: string };

const createSchedule = (session: Session, body: Record<string, unknown>): Promise<string> =>
  api("POST", "/schedules", { token: session.token, body }).then((response) => {
    expectStatus(response, 201, "alta de horario");
    return (response.body as { id: string }).id;
  });

const assign = async (session: Session, scheduleId: string, userIds: string[], from: string): Promise<void> => {
  const response = await api("POST", "/schedules/assignments", {
    token: session.token,
    body: { scheduleId, userIds, from },
  });
  expectStatus(response, 201, `asignación desde ${from}`);
};

/** Vincula el número del reloj con el usuario (lo que hace el padrón del reloj). */
const linkClockEmployee = async (employeeNumber: string, userId: string): Promise<void> => {
  const { prismaClient } = await import("@core/config/database");
  const { runWithTenant } = await import("@core/tenancy/context");
  await runWithTenant(tenant.id, () =>
    prismaClient.timeClockEmployee.create({ data: { tenantId: tenant.id, employeeNumber, userId } })
  );
};

const weekly = async (session: Session) => {
  const response = await api("POST", "/schedules/weekly-attendance", {
    token: session.token,
    body: { date: DAY },
  });
  expectStatus(response, 200, "reporte semanal");
  return response.body as { range: { timezone: string; days: string[] }; rows: WeeklyRow[] };
};

const weekDayOf = (row: WeeklyRow, date = DAY): DayRow => {
  const day = row.days.find((d) => d.date === date);
  assert.ok(day, `el reporte trae el día ${date}`);
  return day;
};

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });

  // Empleado del caso DEMO-911 (Alberto Navarro) y uno de retardo simple.
  const demoNumber = unique("DEMO911");
  const demo = await createUser({
    tenantId: tenant.id,
    role: "CLIENT_STAFF",
    employeeNumber: demoNumber,
    jobTitle: "Camarista",
  });
  demoEmployee = { id: demo.id, employeeNumber: demoNumber, name: `Usuario ${demo.username}` };
  await linkClockEmployee(demoNumber, demo.id);

  const fiveNumber = unique("CINCO");
  const five = await createUser({
    tenantId: tenant.id,
    role: "CLIENT_STAFF",
    employeeNumber: fiveNumber,
    jobTitle: "Analista",
  });
  fiveMinEmployee = { id: five.id, employeeNumber: fiveNumber, name: `Usuario ${five.username}` };
  await linkClockEmployee(fiveNumber, five.id);

  // Horarios con días de jueves (weekday 4).
  const days = (startTime: string, endTime: string, restDay = false) => [
    { weekday: 4, startTime, endTime, splitStartTime: null, splitEndTime: null, restDay },
  ];
  const matutino = await createSchedule(admin, {
    name: "Matutino",
    entryToleranceMin: 10,
    days: days("09:00", "18:00"),
  });
  const vespertino = await createSchedule(admin, {
    name: "Vespertino",
    entryToleranceMin: 10,
    days: days("15:00", "23:00"),
  });
  const oficina = await createSchedule(admin, {
    name: "Oficina tolerancia 0",
    entryToleranceMin: 0,
    days: days("09:00", "18:00"),
  });

  // DEMO-911: primero se asigna el Vespertino (vigente desde el día 3) y luego
  // se captura una corrección HACIA ATRÁS al Matutino (desde el día 1). El alta
  // no cierra la asignación del día 3 → las dos quedan vigentes el día 5.
  await assign(admin, vespertino, [demo.id], "2026-11-03");
  await assign(admin, matutino, [demo.id], "2026-11-01");

  // Retardo de 5 minutos: entrada 09:05 contra 09:00 sin tolerancia.
  await assign(admin, oficina, [five.id], "2026-11-01");

  await createPunch(tenant.id, { employeeNumber: demoNumber, name: demo.username.toUpperCase(), occurredAt: DEMO_ENTRY });
  await createPunch(tenant.id, { employeeNumber: demoNumber, name: demo.username.toUpperCase(), occurredAt: DEMO_EXIT });
  await createPunch(tenant.id, {
    employeeNumber: fiveNumber,
    name: five.username.toUpperCase(),
    occurredAt: new Date("2026-11-05T15:05:00.000Z"), // 09:05 CDMX
  });
  await createPunch(tenant.id, {
    employeeNumber: fiveNumber,
    name: five.username.toUpperCase(),
    occurredAt: new Date("2026-11-05T23:00:00.000Z"), // 17:00 CDMX
  });
});

after(async () => {
  await stopSuite();
});

test("DEMO-911: gana el horario vigente al final → retardo 0, no 5:59 h", async () => {
  const report = await weekly(admin);
  assert.equal(report.range.timezone, CDMX);
  assert.ok(report.range.days.includes(DAY), "la semana incluye el jueves del caso");

  const row = report.rows.find((r) => r.userId === demoEmployee.id);
  assert.ok(row, "el reporte incluye al empleado del caso");
  assert.equal(row.linked, true);
  const day = weekDayOf(row);
  assert.equal(
    row.scheduleName,
    "Vespertino",
    `usa la reasignación vigente, no el Matutino viejo (retardo calculado: ${day.lateMin} min)`
  );
  assert.equal(day.lateMin, 0, "14:58 para un turno de 15:00 no es retardo");
  assert.equal(day.shift, "15:00-23:00");
  assert.equal(day.status, "WORKED");
});

test("el retardo se reporta en minutos: 5, no 5:59 h", async () => {
  const report = await weekly(admin);
  const row = report.rows.find((r) => r.userId === fiveMinEmployee.id);
  assert.ok(row, "el reporte incluye al empleado con retardo");
  assert.equal(row.scheduleName, "Oficina tolerancia 0");

  const day = weekDayOf(row);
  assert.equal(day.lateMin, 5, "entrada 09:05 contra 09:00 sin tolerancia");
  assert.equal(day.status, "WORKED");
});

test("la asistencia por persona (Entradas y salidas) reporta el mismo retardo", async () => {
  const response = await api("POST", "/schedules/attendance/time-clock", {
    token: admin.token,
    body: { page: 1, limit: 50, filters: { period: "DAY", date: DAY } },
  });
  expectStatus(response, 200, "entradas y salidas del día");

  const rows = (response.body as { data: Array<{ employeeId: string; days: Array<{ date: string; lateMinutes: number; status: string }> }> }).data;
  const demoRow = rows.find((r) => r.employeeId === demoEmployee.id);
  assert.ok(demoRow, "la fila del empleado del caso");
  const demoDay = demoRow.days.find((d) => d.date === DAY);
  assert.ok(demoDay);
  assert.equal(demoDay.lateMinutes, 0, "misma regla que la pre-nómina: sin retardo inventado");
  assert.equal(demoDay.status, "ATTENDED");
});
