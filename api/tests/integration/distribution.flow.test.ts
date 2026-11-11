/**
 * Fase 2: convenio de distribución (RJ-01) y jornada diaria/tope 12 h (RJ-08).
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
  login,
  setupSuite,
  stopSuite,
} from "./harness";
import { localDateKey } from "@core/utils/timezone";

const getDb = async () => (await import("@core/config/database")).prismaClient;
const TZ = "America/Mexico_City";
const day = (weekday: number, startTime: string, endTime: string) => ({
  weekday,
  startTime,
  endTime,
  splitStartTime: null,
  splitEndTime: null,
  restDay: false,
});

let today = "";

before(async () => {
  await setupSuite();
  // Último día hábil (lun–vie): el horario de prueba no trabaja en fin de semana.
  const now = new Date();
  for (;;) {
    today = localDateKey(now, TZ);
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) break;
    now.setTime(now.getTime() - 24 * 60 * 60 * 1000);
  }
});

after(async () => {
  await stopSuite();
});

describe("convenio art. 58 y jornada diaria", () => {
  test("bloquea un horario con día mayor a 12 h", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const created = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Jornada 13 h",
        mealBreakMin: 0,
        days: [1, 2, 3, 4, 5].map((weekday) => day(weekday, "09:00", "22:00")),
      },
    });
    expectError(created, 400, "SCHEDULE_ILLEGAL", "día mayor al tope de 12 h");
  });

  test("sin convenio la jornada ordinaria se topa a 8 h y el exceso es extra", async () => {
    const tenant = await createTenant();
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const worker = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: `DIST-${Date.now()}`,
    });

    const schedule = await api("POST", "/schedules", {
      token: admin.token,
      body: {
        name: "Turno 9 h",
        mealBreakMin: 0,
        minOvertimeMin: 60,
        days: [1, 2, 3, 4, 5].map((weekday) => day(weekday, "09:00", "18:00")),
      },
    });
    expectStatus(schedule, 201, "horario de 9 h");
    const assigned = await api("POST", "/schedules/assignments", {
      token: admin.token,
      body: { scheduleId: schedule.body?.id, userIds: [worker.id], from: today },
    });
    expectStatus(assigned, 201, "asignación");

    const client = await getDb();
    const employeeNumber = `DIST-${Date.now()}`;
    await client.timeClockEmployee.create({
      data: { tenantId: tenant.id, employeeNumber, userId: worker.id },
    });
    await client.timeClockPunch.createMany({
      data: [
        {
          tenantId: tenant.id,
          clockSerial: "DIST-CLOCK",
          serialNo: 1,
          employeeNumber,
          name: "Trabajador Convenio",
          method: "FACE",
          minor: 75,
          occurredAt: new Date(`${today}T09:00:00-06:00`),
        },
        {
          tenantId: tenant.id,
          clockSerial: "DIST-CLOCK",
          serialNo: 2,
          employeeNumber,
          name: "Trabajador Convenio",
          method: "FACE",
          minor: 75,
          occurredAt: new Date(`${today}T18:00:00-06:00`),
        },
      ],
    });

    const report = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: today, refresh: true },
    });
    expectStatus(report, 200, "reporte sin convenio");
    const row = (report.body?.rows as Array<{ userId: string; totals: { extraMin: number; scheduledMin: number } }>).find(
      (candidate) => candidate.userId === worker.id
    );
    assert.ok(row, "persona en el reporte");
    assert.equal(row!.totals.scheduledMin, 480, "la jornada de hoy se topa a 8 h");
    assert.equal(row!.totals.extraMin, 60, "la hora extra diaria se detecta");

    // D-1: un convenio colectivo sin sindicato se rechaza.
    const badCollective = await api("POST", "/nom/distribution-agreements", {
      token: admin.token,
      body: {
        userId: worker.id,
        kind: "COLECTIVO",
        party: "WORKER",
        effectiveFrom: today,
        evidenceText: "Convenio colectivo sin representación sindical (debe rechazarse).",
      },
    });
    expectError(badCollective, 400, "AGREEMENT_UNION_REQUIRED", "colectivo sin sindicato");

    const agreement = await api("POST", "/nom/distribution-agreements", {
      token: admin.token,
      body: {
        userId: worker.id,
        kind: "INDIVIDUAL",
        party: "WORKER",
        effectiveFrom: today,
        evidenceText: "Convenio individual de distribución de jornada firmado por ambas partes.",
      },
    });
    expectStatus(agreement, 201, "convenio de distribución");
    const workerSession = await login({ username: worker.username, tenant: tenant.slug });
    const mine = await api("GET", "/nom/me/distribution-agreements", { token: workerSession.token });
    expectStatus(mine, 200, "convenios del trabajador");
    const pending = (mine.body as Array<{ id: string; acceptedAt: string | null }>).find(
      (row) => row.id === agreement.body?.id
    );
    assert.equal(pending?.acceptedAt, null, "el trabajador ve su convenio pendiente");
    const accepted = await api("POST", `/nom/me/distribution-agreements/${agreement.body?.id}/accept`, {
      token: workerSession.token,
    });
    expectStatus(accepted, 200, "aceptación del convenio");

    const withAgreement = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: today, refresh: true },
    });
    expectStatus(withAgreement, 200, "reporte con convenio");
    const rowWith = (withAgreement.body?.rows as Array<{ userId: string; totals: { extraMin: number; scheduledMin: number } }>).find(
      (candidate) => candidate.userId === worker.id
    );
    assert.equal(rowWith!.totals.scheduledMin, 540, "con convenio se reconoce la jornada de 9 h");
    assert.equal(rowWith!.totals.extraMin, 0, "sin exceso sobre lo convenido");
  });
});
