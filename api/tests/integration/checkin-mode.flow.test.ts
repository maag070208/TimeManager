/**
 * Canales de checada del cliente (EMP-05, NOM-01/ACT-33) y flujo único de
 * checadas.
 *
 * El cliente contrata un mix de canales (`Tenant.punchChannels`: WEB, APP y/o
 * CLOCK). El marcaje remoto se permite según el canal y las políticas del
 * cliente, no según el modo preferido del empleado (`User.checkinMode`, que
 * queda solo como preferencia histórica). Todas las checadas de la persona —
 * reloj y web/app — forman UNA sola línea de tiempo, así que una entrada web y
 * una salida del reloj son la misma jornada.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  api,
  clientSession,
  createPunch,
  createTenant,
  createUser,
  expectError,
  expectStatus,
  login,
  setupSuite,
  stopSuite,
  unique,
} from "./harness";
import { localDateKey } from "@core/utils/timezone";

const TZ = "America/Mexico_City";
const db = async () => (await import("@core/config/database")).prismaClient;

/** La plataforma cambia los canales del cliente (no hay endpoint de cliente para esto). */
const setChannels = async (tenantId: string, channels: Array<"WEB" | "APP" | "CLOCK">): Promise<void> => {
  const client = await db();
  await client.tenant.update({ where: { id: tenantId }, data: { punchChannels: channels } });
  // La caché de canales dura 60 s; en la prueba se cambia varias veces.
  const { forgetTenantPunchChannels } = await import("@core/utils/tenant-punch-channels");
  forgetTenantPunchChannels(tenantId);
};

const setTimezone = async (tenantId: string, timezone: string): Promise<void> => {
  const client = await db();
  await client.tenant.update({ where: { id: tenantId }, data: { timezone } });
};

const linkClockEmployee = async (tenantId: string, employeeNumber: string, userId: string): Promise<void> => {
  const client = await db();
  await client.timeClockEmployee.create({ data: { tenantId, employeeNumber, userId } });
};

const punch = (token: string, body: Record<string, unknown>, headers?: Record<string, string>) =>
  api("POST", "/nom/me/punch", { token, body, headers });

const reportDay = async (token: string, date: string) =>
  api("POST", "/time-clock/report", {
    token,
    body: { page: 1, limit: 100, filters: { period: "DAY", date, tz: TZ } },
  });

before(async () => {
  await setupSuite();
});
after(async () => {
  await stopSuite();
});

describe("canales de checada del cliente", () => {
  test("[EMP-05][NOM-01][ACT-33] el canal contratado decide el marcaje remoto, no el modo del empleado", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("CLIENT_ADMIN", { tenant });
    const employee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const session = await login({ username: employee.username, tenant: tenant.slug });

    // El modo preferido del empleado ya no bloquea el marcaje: manda el canal.
    const setClock = await api("PATCH", `/hr/${employee.id}/profile`, {
      token: hr.token,
      body: { checkinMode: "CLOCK" },
    });
    expectStatus(setClock, 200, "modo CLOCK");

    // Cliente solo-reloj: ningún canal remoto habilitado.
    await setChannels(tenant.id, ["CLOCK"]);
    expectError(
      await punch(session.token, { type: "ENTRY", clientEventId: randomUUID() }),
      403,
      "PUNCH_CHANNEL_DISABLED",
      "marcaje web sin canal WEB"
    );

    // WEB contratado: el modo CLOCK del empleado ya no es candado; el candado es el acuerdo.
    await setChannels(tenant.id, ["WEB", "CLOCK"]);
    const config = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { remotePunchEnabled: true, blockRemoteWithoutAgreement: true, lunchPunchEnabled: false },
    });
    expectStatus(config, 200, "config de marcaje remoto");

    const telework = await api("GET", "/nom/me/telework", { token: session.token });
    expectStatus(telework, 200, "estado de teletrabajo");
    assert.deepEqual(telework.body?.punchChannels, ["WEB", "CLOCK"], "el portal conoce el mix del cliente");
    assert.equal(telework.body?.canPunchWeb, true);
    assert.equal(telework.body?.canPunchApp, false, "la app no está contratada");
    assert.equal(telework.body?.canPunchRemote, true, "hay al menos un canal remoto");

    // La app móvil usa el header; sin canal APP se rechaza aunque la web sí pueda.
    expectError(
      await punch(session.token, { type: "ENTRY", clientEventId: randomUUID() }, { "X-Punch-Source": "APP" }),
      403,
      "PUNCH_CHANNEL_DISABLED",
      "marcaje desde la app sin canal APP"
    );
    expectError(
      await punch(session.token, { type: "ENTRY", clientEventId: randomUUID() }),
      403,
      "REMOTE_AGREEMENT_REQUIRED",
      "marcaje web con modo CLOCK y sin acuerdo"
    );

    await api("POST", "/nom/me/record-agreement/accept", {
      token: session.token,
      body: { methods: ["CLOCK", "REMOTE"], roundingPolicy: "Minutos exactos", correctionRules: "Ajuste aprobado" },
    });
    const web = await punch(session.token, { type: "ENTRY", clientEventId: randomUUID() });
    expectStatus(web, 201, "marcaje web pese al modo CLOCK del empleado");
    assert.equal(web.body?.punch?.source, "WEB", "la checada guarda su canal");

    const invalid = await api("PATCH", `/hr/${employee.id}/profile`, {
      token: hr.token,
      body: { checkinMode: "TELEPATIA" },
    });
    expectStatus(invalid, 400, "modo inválido");
  });

  test("ENTRY web + EXIT del reloj = una sola sesión MIXED", async () => {
    const tenant = await createTenant();
    await setChannels(tenant.id, ["WEB", "CLOCK"]);
    await setTimezone(tenant.id, TZ);
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const employeeNumber = unique("MIX");
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber,
    });
    const session = await login({ username: employee.username, tenant: tenant.slug });
    await linkClockEmployee(tenant.id, employeeNumber, employee.id);
    await api("PUT", "/nom/config", {
      token: admin.token,
      body: { remotePunchEnabled: true, blockRemoteWithoutAgreement: false },
    });

    const entry = await punch(session.token, { type: "ENTRY", clientEventId: randomUUID() });
    expectStatus(entry, 201, "entrada desde la web");
    const entryAt = new Date(entry.body!.punch.occurredAt as string);
    // La salida se hace en el reloj físico diez minutos después (más que el dedupe de 5 min).
    const clockExitAt = new Date(entryAt.getTime() + 10 * 60_000);
    await createPunch(tenant.id, {
      employeeNumber,
      name: `Usuario ${employee.username}`,
      occurredAt: clockExitAt,
    });

    const today = localDateKey(new Date(), TZ);
    const report = await reportDay(admin.token, today);
    expectStatus(report, 200, "reporte del día");
    const rows = (report.body!.data as Array<Record<string, any>>).filter((row) => row.employeeId === employee.id);
    assert.equal(rows.length, 1, "la entrada web y la salida del reloj son UNA sola sesión");
    assert.equal(rows[0].source, "MIXED", "la sesión combina canales");
    assert.equal(rows[0].entryAt, entryAt.toISOString());
    assert.equal(rows[0].exitAt, clockExitAt.toISOString());
    assert.equal(rows[0].workedMinutes, 10);
    assert.equal(rows[0].incident, null, "la jornada quedó completa");
    assert.equal(rows[0].linked, true);
  });

  test("sin canal CLOCK no hay UNLINKED ni NO_INFO por falta de reloj", async () => {
    const tenant = await createTenant();
    // Cliente que solo contrató web/app: no existe reloj que configurar.
    await setChannels(tenant.id, ["WEB", "APP"]);
    await setTimezone(tenant.id, TZ);
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const worker = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });

    // Horario vigente: el único motivo válido para NO_INFO es que hoy aún no checa.
    const schedule = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Oficina",
        entryToleranceMin: 10,
        days: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startTime: "09:00",
          endTime: "18:00",
          splitStartTime: null,
          splitEndTime: null,
          restDay: false,
        })),
      },
    });
    expectStatus(schedule, 201, "alta de horario");
    const today = localDateKey(new Date(), TZ);
    const from = new Date(`${today}T12:00:00.000Z`);
    from.setUTCDate(from.getUTCDate() - 14);
    const assigned = await api("POST", "/schedules/assignments", {
      token: admin.token,
      body: { scheduleId: schedule.body?.id, userIds: [worker.id], from: from.toISOString().slice(0, 10) },
    });
    expectStatus(assigned, 201, "asignación de horario");

    // Checadas de un número sin vincular: con CLOCK serían "sin vínculo al reloj";
    // sin el canal no deben producir avisos ni consultarse.
    await createPunch(tenant.id, { employeeNumber: unique("SIN-VINCULO"), name: "SIN VINCULO" });

    const gaps = await api("GET", "/dashboard/setup-gaps", { token: admin.token });
    expectStatus(gaps, 200, "pendientes de configuración");
    assert.equal(gaps.body?.unlinkedClockNumbers, 0, "sin CLOCK no hay checadas del reloj por vincular");
    assert.equal(gaps.body?.personalWithoutClock, 0, "sin CLOCK no hay a quién le falte el reloj");

    const board = await api("GET", "/dashboard/attendance-today", { token: admin.token });
    expectStatus(board, 200, "asistencia de hoy");
    const boardRow = (board.body?.rows as Array<{ userId: string; status: string }>).find(
      (row) => row.userId === worker.id
    );
    assert.ok(boardRow, "la persona aparece en el tablero");
    assert.notEqual(boardRow.status, "UNLINKED", "nadie queda sin vínculo sin canal CLOCK");
    assert.equal(board.body?.counts?.UNLINKED, 0, "el conteo de sin vínculo queda en cero");

    const weekly = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: today, refresh: true },
    });
    expectStatus(weekly, 200, "reporte semanal");
    const weekRow = (weekly.body?.rows as Array<{ userId: string; linked: boolean; days: Array<{ date: string; status: string }> }>).find(
      (row) => row.userId === worker.id
    );
    assert.ok(weekRow, "la persona aparece en el reporte semanal");
    assert.equal(weekRow.linked, true, "sin CLOCK toda la plantilla está vinculada");
    assert.equal(weekly.body?.summary?.unlinked, 0);
    const pastDays = weekRow.days.filter((day) => day.date < today);
    assert.ok(pastDays.length > 0, "el reporte trae días pasados");
    assert.ok(
      pastDays.every((day) => day.status !== "NO_INFO"),
      `los días pasados con horario no son NO_INFO: ${JSON.stringify(pastDays.map((d) => [d.date, d.status]))}`
    );
  });
});
