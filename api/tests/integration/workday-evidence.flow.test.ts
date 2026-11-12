/**
 * Fase 1 del plan de cierre de huecos:
 * RJ-02 (marcaje web suma jornada), RJ-03 (ajustes aprobados cuentan) y
 * RJ-06 (export con primera entrada, detalle y hash final verificable).
 */
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  createUser,
  expectStatus,
  login,
  setupSuite,
  stopSuite,
  type Session,
  type TenantFixture,
} from "./harness";
import { localDateKey } from "@core/utils/timezone";

const getDb = async () => (await import("@core/config/database")).prismaClient;

let tenant: TenantFixture;
let admin: Session;
let workerId = "";
const TZ = "America/Mexico_City";
let today = "";

const at = (time: string): Date => new Date(`${today}T${time}:00-06:00`);

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  const worker = await createUser({
    tenantId: tenant.id,
    role: "CLIENT_STAFF",
    employeeNumber: `WEB-${Date.now()}`,
  });
  workerId = worker.id;
  today = localDateKey(new Date(), TZ);
});

after(async () => {
  await stopSuite();
});

describe("evidencia de jornada", () => {
  test("el marcaje web cuenta como jornada y la comida no se suma", async () => {
    const client = await getDb();
    await client.remotePunch.createMany({
      data: [
        { tenantId: tenant.id, userId: workerId, type: "ENTRY", workMode: "REMOTO", occurredAt: at("08:00") },
        { tenantId: tenant.id, userId: workerId, type: "LUNCH_START", workMode: "REMOTO", occurredAt: at("13:00") },
        { tenantId: tenant.id, userId: workerId, type: "LUNCH_END", workMode: "REMOTO", occurredAt: at("14:00") },
        { tenantId: tenant.id, userId: workerId, type: "EXIT", workMode: "REMOTO", occurredAt: at("17:00") },
      ],
    });

    const report = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: today, refresh: true },
    });
    expectStatus(report, 200, "reporte semanal con marcaje web");
    const row = (report.body?.rows as Array<{ userId?: string; totals: { workedMin: number }; days: Array<{ date: string; status: string }> }>).find(
      (candidate) => (candidate as unknown as { userId: string }).userId === workerId
    ) ?? (report.body?.rows as Array<{ id: string; totals: { workedMin: number } }>).find(
      (candidate) => candidate.id === workerId
    );
    assert.ok(row, "la persona aparece en el reporte");
    // 5 h de la mañana + 3 h de la tarde = 8 h (la comida no cuenta).
    assert.equal(row!.totals.workedMin, 480);
    const day = row!.days.find((d) => d.date === today);
    assert.equal(day?.status, "WORKED");
  });

  test("un marcaje web se corrige con discrepancia y aprobación (RJ-04)", async () => {
    const client = await getDb();
    const remoteWorker = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: `REM-${Date.now()}`,
    });
    const workerSession = await login({ username: remoteWorker.username, tenant: tenant.slug });
    const entry = await client.remotePunch.create({
      data: {
        tenantId: tenant.id,
        userId: remoteWorker.id,
        type: "ENTRY",
        workMode: "REMOTO",
        occurredAt: at("09:00"),
      },
    });
    await client.remotePunch.create({
      data: {
        tenantId: tenant.id,
        userId: remoteWorker.id,
        type: "EXIT",
        workMode: "REMOTO",
        occurredAt: at("17:00"),
      },
    });

    const discrepancy = await api("POST", "/nom/me/discrepancies", {
      token: workerSession.token,
      body: {
        punchId: entry.id,
        reason: "Entré a las 08:00, no a las 09:00",
        expectedOccurredAt: at("08:00").toISOString(),
      },
    });
    expectStatus(discrepancy, 201, "discrepancia de marcaje web");

    const approved = await api("POST", `/nom/adjustments/${discrepancy.body?.id}/approve`, {
      token: admin.token,
      body: { note: "Corregido" },
    });
    expectStatus(approved, 200, "aprobación del ajuste remoto");

    const history = await api("GET", `/nom/punches/${entry.id}/history`, { token: admin.token });
    expectStatus(history, 200, "historial del marcaje remoto");
    assert.equal((history.body?.effective as { occurredAt: string }).occurredAt, at("08:00").toISOString());

    const report = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: today, refresh: true },
    });
    expectStatus(report, 200, "reporte con ajuste remoto");
    const row = (report.body?.rows as Array<{ userId: string; totals: { workedMin: number } }>).find(
      (candidate) => candidate.userId === remoteWorker.id
    );
    assert.ok(row, "persona con marcaje remoto ajustado");
    // 08:00 → 17:00 = 9 h (la corrección sí suma).
    assert.equal(row!.totals.workedMin, 540);
  });

  test("un ajuste aprobado corrige la jornada y el export lo refleja", async () => {
    const client = await getDb();
    // Persona nueva: el flujo único mezcla TODAS las fuentes de una persona, así
    // que reutilizar al trabajador de los casos anteriores metería sus marcajes
    // web en esta jornada del reloj.
    const employeeNumber = `ADJ-${Date.now()}`;
    const adjWorker = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber,
    });
    await client.timeClockEmployee.create({
      data: { tenantId: tenant.id, employeeNumber, userId: adjWorker.id },
    });
    const punch = await client.timeClockPunch.create({
      data: {
        tenantId: tenant.id,
        clockSerial: "ADJ-CLOCK",
        serialNo: Math.floor(Math.random() * 1_000_000),
        employeeNumber,
        name: "Trabajador Ajustado",
        method: "FACE",
        minor: 75,
        occurredAt: at("09:00"),
      },
    });
    await client.punchAdjustment.create({
      data: {
        tenantId: tenant.id,
        targetType: "CLOCK",
        targetId: punch.id,
        punchId: punch.id,
        requestedById: adjWorker.id,
        reason: "Entró a las 10:00, no a las 09:00",
        previousState: { occurredAt: at("09:00").toISOString() },
        newState: { occurredAt: at("10:00").toISOString() },
        status: "APPROVED",
        decidedById: admin.user.id,
        decidedAt: new Date(),
      },
    });
    // Salida después de la entrada corregida.
    await client.timeClockPunch.create({
      data: {
        tenantId: tenant.id,
        clockSerial: "ADJ-CLOCK",
        serialNo: Math.floor(Math.random() * 1_000_000),
        employeeNumber,
        name: "Trabajador Ajustado",
        method: "FACE",
        minor: 75,
        occurredAt: at("18:00"),
      },
    });

    const report = await api("POST", "/schedules/weekly-attendance", {
      token: admin.token,
      body: { date: today, refresh: true },
    });
    expectStatus(report, 200, "reporte con ajuste");
    const row = (report.body?.rows as Array<{ id?: string; userId?: string; totals: { workedMin: number } }>).find(
      (candidate) => candidate.id === adjWorker.id || candidate.userId === adjWorker.id
    );
    assert.ok(row, "persona del ajuste en el reporte");
    // 10:00 → 18:00 = 8 h; sin el ajuste serían 9 h.
    assert.equal(row!.totals.workedMin, 480);

    const exported = await api("GET", `/nom/export/stps?period=WEEK&date=${today}&format=csv`, {
      token: admin.token,
    });
    expectStatus(exported, 200, "export STPS");
    assert.match(exported.text, /# marcajes \(detalle/);
    assert.match(exported.text, /primeraEntrada,ultimaSalida,origen/);

    const lines = exported.text.trimEnd().split("\n");
    const hashLine = lines.find((line) => line.startsWith("# sha256:"));
    assert.ok(hashLine, "el export trae sha256");
    const digest = hashLine!.replace("# sha256: ", "");
    const unsigned = lines.filter((line) => !line.startsWith("# sha256:")).join("\n");
    assert.equal(digest, createHash("sha256").update(unsigned).digest("hex"));
  });
});
