/**
 * NOM / registro electrónico de jornada (LFT art. 132 fr. XXXIV, 2027).
 *
 * Cubre F2-01 (checadas inmutables + ajustes con aprobación), F2-02 (historial
 * y auditoría por checada), F2-03 (configuración de límites + barrido de
 * alertas), F2-04 (retención y archivado), el export formal y el flujo del
 * trabajador (consultar sus marcajes y reportar discrepancia).
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
  platformSession,
  setupSuite,
  stopSuite,
  unique,
} from "./harness";

const prismaClient = async () =>
  (await import("@core/config/database")).prismaClient;

const iso = (date: Date) => date.toISOString();

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("F2-01 checadas inmutables y ajustes", () => {
  test("una checada no se puede editar ni borrar (append-only en la BD)", async () => {
    const tenant = await createTenant();
    const punch = await createPunch(tenant.id, {
      employeeNumber: unique("E"),
      name: "Ana Inmutable",
      occurredAt: new Date("2026-11-04T14:00:00.000Z"),
    });
    const db = await prismaClient();

    await assert.rejects(
      db.timeClockPunch.update({ where: { id: punch.id }, data: { name: "Hackeado" } }),
      "UPDATE a una checada debe fallar"
    );
    await assert.rejects(
      db.timeClockPunch.delete({ where: { id: punch.id } }),
      "DELETE de una checada debe fallar"
    );

    const row = await db.timeClockPunch.findUnique({ where: { id: punch.id } });
    assert.ok(row, "la checada sigue existiendo");
    assert.equal(row.name, "Ana Inmutable");
    assert.equal(iso(row.occurredAt), "2026-11-04T14:00:00.000Z");
  });

  test("un ajuste NO toca la checada; requiere aprobación de otra persona y queda auditado", async () => {
    const tenant = await createTenant();
    const requester = await clientSession("HUMAN_RESOURCES", { tenant });
    const approver = await clientSession("HUMAN_RESOURCES", { tenant });
    const punch = await createPunch(tenant.id, {
      employeeNumber: unique("E"),
      name: "Luis Ajuste",
      occurredAt: new Date("2026-11-04T14:00:00.000Z"),
    });

    const created = await api("POST", `/nom/punches/${punch.id}/adjustments`, {
      token: requester.token,
      body: {
        reason: "El reloj registró la salida del turno anterior",
        occurredAt: "2026-11-04T15:02:00.000Z",
      },
    });
    expectStatus(created, 201, "alta de ajuste");
    const adjustmentId = created.body?.id as string;
    assert.equal(created.body?.status, "PENDING");
    assert.equal(created.body?.requestedById, requester.user.id);
    assert.equal(created.body?.previousState?.occurredAt, "2026-11-04T14:00:00.000Z");
    assert.equal(created.body?.newState?.occurredAt, "2026-11-04T15:02:00.000Z");

    // La checada original sigue intacta.
    const db = await prismaClient();
    const untouched = await db.timeClockPunch.findUnique({ where: { id: punch.id } });
    assert.equal(iso(untouched!.occurredAt), "2026-11-04T14:00:00.000Z");

    // Nadie aprueba su propio ajuste.
    const selfApproval = await api("POST", `/nom/adjustments/${adjustmentId}/approve`, {
      token: requester.token,
      body: {},
    });
    expectError(selfApproval, 403, "SELF_APPROVAL_FORBIDDEN", "autoaprobación");

    const approved = await api("POST", `/nom/adjustments/${adjustmentId}/approve`, {
      token: approver.token,
      body: { note: "Verificado contra el reporte del reloj" },
    });
    expectStatus(approved, 200, "aprobación");
    assert.equal(approved.body?.status, "APPROVED");
    assert.equal(approved.body?.decidedById, approver.user.id);

    // El historial de la checada muestra el valor vigente y la pista de auditoría.
    const history = await api("GET", `/nom/punches/${punch.id}/history`, {
      token: requester.token,
    });
    expectStatus(history, 200, "historial de la checada");
    assert.equal(history.body?.effective?.occurredAt, "2026-11-04T15:02:00.000Z");
    assert.deepEqual(history.body?.effective?.appliedAdjustmentIds, [adjustmentId]);
    assert.equal(history.body?.adjustments?.length, 1);
    const actions = (history.body?.audit as Array<{ action: string }>).map((entry) => entry.action);
    assert.ok(actions.includes("PUNCH_ADJUSTMENT_REQUESTED"), "audita la solicitud");
    assert.ok(actions.includes("PUNCH_ADJUSTMENT_APPROVED"), "audita la aprobación");

    // Filtro nuevo del módulo de auditoría: por entidad concreta.
    const platform = await platformSession("ADMIN");
    const audit = await api(
      "GET",
      `/audit?entityType=TimeClockPunch&entityId=${punch.id}&limit=50`,
      { token: platform.token, tenantId: tenant.id }
    );
    expectStatus(audit, 200, "auditoría por entidad");
    assert.ok((audit.body?.total as number) >= 2, "hay al menos solicitud y aprobación");

    // Un ajuste ya decidido no se vuelve a decidir.
    const again = await api("POST", `/nom/adjustments/${adjustmentId}/reject`, {
      token: approver.token,
      body: {},
    });
    expectError(again, 409, "PUNCH_ADJUSTMENT_NOT_PENDING", "re-decisión");
  });

  test("otro cliente no ve ni ajusta una checada ajena (404)", async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const punch = await createPunch(tenantA.id, {
      employeeNumber: unique("E"),
      name: "Ajeno",
    });
    const hrB = await clientSession("HUMAN_RESOURCES", { tenant: tenantB });

    const history = await api("GET", `/nom/punches/${punch.id}/history`, { token: hrB.token });
    expectError(history, 404, "PUNCH_NOT_FOUND", "historial cross-tenant");

    const adjustment = await api("POST", `/nom/punches/${punch.id}/adjustments`, {
      token: hrB.token,
      body: { reason: "Intento desde otro cliente" },
    });
    expectError(adjustment, 404, "PUNCH_NOT_FOUND", "ajuste cross-tenant");
  });
});

describe("F2-01/F2-02 flujo del trabajador", () => {
  test("consulta sus marcajes y reporta una discrepancia; no puede tocar la de otro", async () => {
    const tenant = await createTenant();
    const employeeNumber = unique("E");
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber,
      email: null,
    });
    const session = await login({ username: employee.username, tenant: tenant.slug });
    const today = new Date();
    const punch = await createPunch(tenant.id, {
      employeeNumber,
      name: "Trabajador Uno",
      occurredAt: today,
    });

    const mine = await api("GET", "/nom/me/punches", { token: session.token });
    expectStatus(mine, 200, "marcajes propios");
    assert.ok(
      (mine.body as Array<{ id: string }>).some((row) => row.id === punch.id),
      "el marcaje propio aparece"
    );

    const reported = await api("POST", "/nom/me/discrepancies", {
      token: session.token,
      body: {
        punchId: punch.id,
        reason: "Mi salida quedó registrada 40 minutos antes",
        expectedOccurredAt: today.toISOString(),
      },
    });
    expectStatus(reported, 201, "reporte de discrepancia");
    assert.equal(reported.body?.requestedById, employee.id);
    assert.equal(reported.body?.status, "PENDING");

    const mineDiscrepancies = await api("GET", "/nom/me/discrepancies", {
      token: session.token,
    });
    expectStatus(mineDiscrepancies, 200, "discrepancias propias");
    assert.ok(
      (mineDiscrepancies.body as Array<{ id: string }>).some((row) => row.id === reported.body?.id)
    );

    // Una checada de otra persona no se puede reportar.
    const otherPunch = await createPunch(tenant.id, {
      employeeNumber: unique("E"),
      name: "Otra Persona",
    });
    const foreign = await api("POST", "/nom/me/discrepancies", {
      token: session.token,
      body: { punchId: otherPunch.id, reason: "Checada de otra persona" },
    });
    expectError(foreign, 403, "NOT_YOUR_PUNCH", "discrepancia de checada ajena");
  });
});

describe("F2-03 límites legales y alertas", () => {
  test("config por cliente: default legal, actualización y auditoría", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });

    const initial = await api("GET", "/nom/config", { token: hr.token });
    expectStatus(initial, 200, "config inicial");
    assert.equal(initial.body?.workdayLimitMinutes, 720, "12 h/día por default");
    assert.equal(initial.body?.source?.workdayLimit, "legal_default");
    assert.equal(initial.body?.weeklyLimitMinutes, initial.body?.legal?.weeklyLimitMinutes);
    assert.equal(initial.body?.retentionMonths, null);

    // Un tope semanal más estricto que el legal del año vigente (2026+).
    const stricterWeekly = Number(initial.body?.legal?.weeklyLimitMinutes) - 60;
    const updated = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { workdayLimitMinutes: 600, weeklyLimitMinutes: stricterWeekly, retentionMonths: 12 },
    });
    expectStatus(updated, 200, "actualización de config");
    assert.equal(updated.body?.workdayLimitMinutes, 600);
    assert.equal(updated.body?.weeklyLimitMinutes, stricterWeekly);
    assert.equal(updated.body?.retentionMonths, 12);
    assert.equal(updated.body?.source?.workdayLimit, "tenant");

    const reread = await api("GET", "/nom/config", { token: hr.token });
    assert.equal(reread.body?.workdayLimitMinutes, 600);

    // Solo más estricto que la ley: ni la jornada diaria ni la semanal pueden
    // superar el tope legal del año vigente.
    const laxDay = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { workdayLimitMinutes: 15 * 60 },
    });
    expectError(laxDay, 400, "INVALID_WORKDAY_LIMIT", "jornada diaria mayor a 12 h");

    const laxWeek = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { weeklyLimitMinutes: 60 * 60 },
    });
    expectError(laxWeek, 400, "INVALID_WEEKLY_LIMIT", "jornada semanal mayor a la legal");
  });

  test("una configuración legada por encima de la ley se recorta al tope legal", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const db = await prismaClient();
    await db.nomSettings.create({
      data: {
        tenantId: tenant.id,
        workdayLimitMinutes: 15 * 60,
        weeklyLimitMinutes: 60 * 60,
        updatedById: hr.user.id,
      },
    });

    const config = await api("GET", "/nom/config", { token: hr.token });
    expectStatus(config, 200, "config con valores legados laxos");
    assert.equal(config.body?.workdayLimitMinutes, 720);
    assert.equal(config.body?.weeklyLimitMinutes, config.body?.legal?.weeklyLimitMinutes);
    assert.equal(config.body?.legal?.weeklyOvertimeLimitMinutes, 540, "9 h al doble en 2026");
    assert.equal(config.body?.legal?.weeklyTripleLimitMinutes, 240);
    assert.equal(config.body?.legal?.dailyOvertimeLimitMinutes, 240);
    assert.equal(config.body?.legal?.maxOvertimeDaysPerWeek, 4);
  });

  test("festivos: siembra obligatorios, alta de convenio y duplicado", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });

    const list = await api("GET", "/nom/holidays?year=2027", { token: hr.token });
    expectStatus(list, 200, "festivos del año");
    const rows = list.body as unknown as Array<{ date: string; name: string }>;
    assert.ok(rows.length >= 7, "siembra los obligatorios del art. 74");
    assert.ok(rows.some((row) => row.date.startsWith("2027-01-01")));
    assert.ok(rows.some((row) => row.name.includes("Constitución")));

    const created = await api("POST", "/nom/holidays", {
      token: hr.token,
      body: { date: "2027-12-24", name: "Nochebuena", kind: "CONVENIO" },
    });
    expectStatus(created, 201, "alta de festivo de convenio");

    const duplicate = await api("POST", "/nom/holidays", {
      token: hr.token,
      body: { date: "2027-12-24", name: "Nochebuena repetida" },
    });
    expectError(duplicate, 409, "HOLIDAY_ALREADY_EXISTS", "festivo duplicado");

    const deleted = await api("DELETE", `/nom/holidays/${created.body?.id}`, { token: hr.token });
    expectStatus(deleted, 200, "baja de festivo");
  });

  test("ledger semanal de horas extra: se calcula, lista y exige permisos", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const staff = await clientSession("CLIENT_STAFF", { tenant });

    const week = await api("GET", "/nom/overtime/weekly?date=2027-03-10", { token: hr.token });
    expectStatus(week, 200, "ledger semanal");
    assert.ok(Array.isArray(week.body), "devuelve una lista de ledgers");

    const recalc = await api("POST", "/nom/overtime/weekly/recalculate", {
      token: hr.token,
      body: { date: "2027-03-10" },
    });
    expectStatus(recalc, 200, "recálculo semanal");

    const denied = await api("GET", "/nom/overtime/weekly?date=2027-03-10", { token: staff.token });
    expectError(denied, 403, "INSUFFICIENT_PERMISSIONS", "ledger sin permiso");
  });

  test("el barrido responde y un empleado sin permisos no puede dispararlo", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const staff = await clientSession("CLIENT_STAFF", { tenant });

    const scan = await api("POST", "/nom/alerts/scan", {
      token: hr.token,
      body: { date: "2026-11-04", scope: "ALL" },
    });
    expectStatus(scan, 200, "barrido de alertas");
    assert.deepEqual(scan.body?.created, []);
    assert.equal(scan.body?.date, "2026-11-04");

    const alerts = await api("GET", "/nom/alerts", { token: hr.token });
    expectStatus(alerts, 200, "lista de alertas");
    assert.deepEqual(alerts.body, []);

    const denied = await api("POST", "/nom/alerts/scan", { token: staff.token, body: {} });
    expectError(denied, 403, "INSUFFICIENT_PERMISSIONS", "barrido sin permiso");
  });
});

describe("F2-04 retención y archivado", () => {
  test("mueve checadas viejas a la tabla de archivo y conserva las recientes", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });

    const configured = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { retentionMonths: 12 },
    });
    expectStatus(configured, 200, "retención configurada");

    const oldPunch = await createPunch(tenant.id, {
      employeeNumber: unique("E"),
      name: "Registro Viejo",
      occurredAt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
    });
    const recentPunch = await createPunch(tenant.id, {
      employeeNumber: unique("E"),
      name: "Registro Reciente",
      occurredAt: new Date(),
    });
    const remoteEmployee = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF" });
    const dbForSetup = await prismaClient();
    await dbForSetup.remotePunch.create({
      data: {
        tenantId: tenant.id,
        userId: remoteEmployee.id,
        type: "ENTRY",
        workMode: "REMOTO",
        occurredAt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      },
    });

    const retention = await api("GET", "/nom/retention", { token: hr.token });
    expectStatus(retention, 200, "estado de retención");
    assert.equal(retention.body?.retentionMonths, 12);
    assert.ok((retention.body?.pending?.punches as number) >= 1);
    assert.ok((retention.body?.pending?.remotePunches as number) >= 1);
    assert.ok(retention.body?.cutoff, "expone el corte");

    const dryRun = await api("POST", "/nom/retention/archive", {
      token: hr.token,
      body: { dryRun: true },
    });
    expectStatus(dryRun, 200, "archivado simulado");
    assert.equal(dryRun.body?.dryRun, true);
    assert.equal(dryRun.body?.punches, 1);
    assert.equal(dryRun.body?.remotePunches, 1);

    const real = await api("POST", "/nom/retention/archive", {
      token: hr.token,
      body: {},
    });
    expectStatus(real, 200, "archivado real");
    assert.equal(real.body?.dryRun, false);
    assert.equal(real.body?.punches, 1);
    assert.equal(real.body?.accessEvents, 0);
    assert.equal(real.body?.remotePunches, 1);

    const db = await prismaClient();
    assert.equal(await db.timeClockPunch.findUnique({ where: { id: oldPunch.id } }), null);
    assert.ok(await db.timeClockPunch.findUnique({ where: { id: recentPunch.id } }));
    const archived = await db.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM nom_archived_time_clock_punches
      WHERE "tenantId" = ${tenant.id} AND "id" = ${oldPunch.id}
    `;
    assert.equal(archived[0].count, 1);
    const archivedRemote = await db.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM nom_archived_remote_punches
      WHERE "tenantId" = ${tenant.id} AND "userId" = ${remoteEmployee.id}
    `;
    assert.equal(archivedRemote[0].count, 1);

    // El histórico de una checada archivada queda como no encontrado.
    const gone = await api("GET", `/nom/punches/${oldPunch.id}/history`, { token: hr.token });
    expectError(gone, 404, "PUNCH_NOT_FOUND", "checada archivada");
  });
  test("el archivado respeta la ventana legal del art. 804 (baja reciente)", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const db = await prismaClient();

    const activeNumber = unique("E-ACT");
    const terminatedNumber = unique("E-TERM");
    await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: activeNumber,
    });
    const terminated = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: terminatedNumber,
    });
    await db.user.update({
      where: { id: terminated.id },
      data: { deactivatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const old = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    await createPunch(tenant.id, {
      employeeNumber: activeNumber,
      name: "Activo Viejo",
      occurredAt: old,
    });
    await createPunch(tenant.id, {
      employeeNumber: terminatedNumber,
      name: "Baja Reciente",
      occurredAt: old,
    });

    await api("PUT", "/nom/config", {
      token: hr.token,
      body: { retentionMonths: 1 },
    });

    const dryRun = await api("POST", "/nom/retention/archive", {
      token: hr.token,
      body: { dryRun: true },
    });
    expectStatus(dryRun, 200, "archivado simulado con baja reciente");
    assert.equal(dryRun.body?.punches, 1, "solo archiva al empleado activo");

    const real = await api("POST", "/nom/retention/archive", { token: hr.token, body: {} });
    expectStatus(real, 200, "archivado real con baja reciente");
    assert.equal(real.body?.punches, 1);
    const remaining = await db.timeClockPunch.count({
      where: { tenantId: tenant.id, employeeNumber: terminatedNumber },
    });
    assert.equal(remaining, 1, "la baja reciente conserva sus registros");
  });

});

describe("Export formal y autoservicio de configuración", () => {
  test("export STPS en JSON y CSV con hash de integridad", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: unique("E"),
    });
    const db = await prismaClient();
    await db.remotePunch.create({
      data: {
        tenantId: tenant.id,
        userId: employee.id,
        type: "ENTRY",
        workMode: "REMOTO",
        occurredAt: new Date("2026-11-04T15:00:00.000Z"),
        latitude: 19.4326,
        longitude: -99.1332,
      },
    });

    const jsonExport = await api(
      "GET",
      "/nom/export/stps?period=MONTH&date=2026-11-04&format=json",
      { token: hr.token }
    );
    expectStatus(jsonExport, 200, "export JSON");
    assert.equal(jsonExport.body?.schemaVersion, "stps-registro-jornada-v2");
    assert.match(String(jsonExport.body?.sha256), /^[0-9a-f]{64}$/);
    assert.ok(Array.isArray(jsonExport.body?.rows));
    assert.equal(jsonExport.body?.tenant?.id, tenant.id);
    assert.equal(jsonExport.headers.get("x-content-sha256"), jsonExport.body?.sha256);
    assert.equal((jsonExport.body?.remotePunches as unknown[]).length, 1);
    assert.equal(jsonExport.body?.totals?.remotePunches, 1);

    const csvExport = await api(
      "GET",
      "/nom/export/stps?period=MONTH&date=2026-11-04&format=csv",
      { token: hr.token }
    );
    expectStatus(csvExport, 200, "export CSV");
    assert.match(String(csvExport.headers.get("content-type")), /text\/csv/);
    assert.ok(csvExport.text.startsWith("# TimeManager"));
    assert.ok(csvExport.text.includes("# sha256: "));
    assert.ok(csvExport.text.includes("fecha,numeroEmpleado,nombre"));
    assert.ok(csvExport.text.includes("extraDoble,extraTriple,excedenteIlegal"));
    assert.ok(csvExport.text.includes("# marcajes remotos (sin reloj físico; hora del servidor)"));
    assert.ok(csvExport.text.includes("19.4326") === false, "no filtra coordenadas al CSV");
    assert.match(
      String(csvExport.headers.get("content-disposition")),
      /attachment; filename="registro-jornada_/
    );
  });
});

describe("F2-07 marcaje remoto (home office/campo)", () => {
  test("marca sin reloj, es idempotente y guarda geolocalización solo en el marcaje", async () => {
    const tenant = await createTenant();
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: unique("E"),
    });
    const session = await login({ username: employee.username, tenant: tenant.slug });
    const clientEventId = randomUUID();

    const entry = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY", workMode: "REMOTO", clientEventId },
    });
    expectStatus(entry, 201, "marcaje remoto ENTRY");
    assert.equal(entry.body?.created, true);
    assert.equal(entry.body?.punch?.type, "ENTRY");
    assert.equal(entry.body?.punch?.workMode, "REMOTO");
    assert.equal(entry.body?.punch?.latitude, null, "sin geolocalización es válido");
    assert.ok(entry.body?.punch?.occurredAt, "hora del servidor");

    // Reintento de red con el mismo clientEventId: no duplica.
    const retry = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY", workMode: "REMOTO", clientEventId },
    });
    expectStatus(retry, 200, "reintento idempotente");
    assert.equal(retry.body?.created, false);
    assert.equal(retry.body?.punch?.id, entry.body?.punch?.id);

    // Secuencia: no se puede repetir ENTRY sin cerrar la jornada.
    const duplicate = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY" },
    });
    expectError(duplicate, 409, "INVALID_PUNCH_SEQUENCE", "secuencia de marcaje");

    // Comida: entrada → salida a comer → regreso de comer → salida.
    const lunchStart = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "LUNCH_START" },
    });
    expectStatus(lunchStart, 201, "salida a comer");
    const entryDuringLunch = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY" },
    });
    expectError(entryDuringLunch, 409, "INVALID_PUNCH_SEQUENCE", "entrada durante comida");
    const lunchEnd = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "LUNCH_END" },
    });
    expectStatus(lunchEnd, 201, "regreso de comer");

    // Geolocalización: ambas coordenadas o ninguna (no hay rastreo continuo).
    const halfGeo = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "EXIT", latitude: 19.4326 },
    });
    expectError(halfGeo, 400, "INVALID_GEO_POINT", "coordenada incompleta");

    const exit = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: {
        type: "EXIT",
        workMode: "CAMPO",
        latitude: 19.4326,
        longitude: -99.1332,
        gpsAccuracyMeters: 15,
        note: "Visita a cliente",
      },
    });
    expectStatus(exit, 201, "marcaje remoto EXIT con GPS");
    assert.equal(exit.body?.punch?.latitude, 19.4326);

    // El portal ve los marcajes remotos junto a reloj/accesos.
    const today = new Date().toISOString().slice(0, 10);
    const mine = await api("GET", `/nom/me/punches?from=${today}&to=${today}`, {
      token: session.token,
    });
    expectStatus(mine, 200, "marcajes propios");
    const remoteRows = (mine.body as Array<{ source: string }>).filter(
      (row) => row.source === "REMOTE"
    );
    assert.ok(remoteRows.length >= 4, "entrada, comida y salida remotas en el portal");

    // El cliente puede deshabilitar el marcaje remoto.
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const off = await api("PUT", "/nom/config", {
      token: hr.token,
      body: { remotePunchEnabled: false },
    });
    expectStatus(off, 200, "marcaje remoto deshabilitado");
    const blocked = await api("POST", "/nom/me/punch", {
      token: session.token,
      body: { type: "ENTRY" },
    });
    expectError(blocked, 403, "REMOTE_PUNCH_DISABLED", "marcaje remoto deshabilitado");
  });
});

describe("F2-08 NOM-037 teletrabajo", () => {
  test("política/aviso por cliente, registro, consentimiento y checklist", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: unique("E"),
    });
    const worker = await login({ username: employee.username, tenant: tenant.slug });

    // Política editable por cliente (versiones para el consentimiento).
    const initialPolicy = await api("GET", "/nom/telework/policy", { token: hr.token });
    expectStatus(initialPolicy, 200, "política inicial");
    assert.equal(initialPolicy.body?.policyVersion, 1);
    assert.equal(initialPolicy.body?.teleworkPolicy, null);

    const updatedPolicy = await api("PUT", "/nom/telework/policy", {
      token: hr.token,
      body: {
        teleworkPolicy:
          "Política de teletrabajo: horario y distribución; desconexión digital; " +
          "riesgos ergonómicos; equipo de trabajo; lactancia; reversibilidad a presencial.",
        disconnectPolicy: "Desconexión digital fuera de la jornada laboral.",
        privacyNotice: "Aviso de privacidad: datos de jornada y ubicación solo al marcar.",
      },
    });
    expectStatus(updatedPolicy, 200, "política actualizada");

    const template = await api("GET", "/nom/telework/policy/template", { token: hr.token });
    expectStatus(template, 200, "plantilla de política NOM-037");
    assert.ok(String(template.body?.template).includes("Desconexión digital"));

    const incompletePolicy = await api("PUT", "/nom/telework/policy", {
      token: hr.token,
      body: { teleworkPolicy: "Política de teletrabajo: horario y equipo." },
    });
    expectError(incompletePolicy, 400, "TELEWORK_POLICY_SECTIONS_MISSING", "política sin secciones");
    assert.equal(updatedPolicy.body?.policyVersion, 2, "incrementa versión de política");
    assert.equal(updatedPolicy.body?.privacyNoticeVersion, 2, "incrementa versión del aviso");

    // Alta de teletrabajador por RH.
    const registration = await api("POST", "/nom/telework/registrations", {
      token: hr.token,
      body: { userId: employee.id, mode: "REMOTO", homeAddress: "Calle Falsa 123" },
    });
    expectStatus(registration, 201, "alta de teletrabajo");
    assert.equal(registration.body?.status, "ACTIVE");

    const duplicate = await api("POST", "/nom/telework/registrations", {
      token: hr.token,
      body: { userId: employee.id },
    });
    expectError(duplicate, 409, "TELEWORK_ALREADY_REGISTERED", "alta duplicada");

    const registrations = await api("GET", "/nom/telework/registrations", {
      token: hr.token,
    });
    expectStatus(registrations, 200, "lista de teletrabajadores");
    assert.ok(
      (registrations.body as Array<{ userId: string }>).some((row) => row.userId === employee.id)
    );

    // El trabajador ve su registro, la política y la plantilla del checklist.
    const me = await api("GET", "/nom/me/telework", { token: worker.token });
    expectStatus(me, 200, "/me/telework");
    assert.equal(me.body?.registration?.userId, employee.id);
    assert.equal(me.body?.pendingConsent, true, "falta aceptar política y checklist");
    assert.equal(me.body?.policy?.policyVersion, 2);
    const items = me.body?.checklistTemplate?.items as string[];
    assert.equal(items.length, 8);

    // Consentimiento: versión vieja → 409; versión vigente → acepta.
    const staleAccept = await api("POST", "/nom/me/telework/accept", {
      token: worker.token,
      body: { policyVersion: 1, privacyNoticeVersion: 1 },
    });
    expectError(staleAccept, 409, "TELEWORK_POLICY_VERSION_CHANGED", "versión vieja");
    const accept = await api("POST", "/nom/me/telework/accept", {
      token: worker.token,
      body: { policyVersion: 2, privacyNoticeVersion: 2 },
    });
    expectStatus(accept, 200, "consentimiento");
    assert.ok(accept.body?.consentAcceptedAt);

    // Checklist: incompleto → 400; completo → INITIAL y luego PERIODIC.
    const incomplete = await api("POST", "/nom/me/telework/checklist", {
      token: worker.token,
      body: { answers: { space_adequate: "YES" } },
    });
    expectError(incomplete, 400, "TELEWORK_CHECKLIST_INCOMPLETE", "checklist incompleto");

    const allYes = Object.fromEntries(items.map((key) => [key, key === "ergonomics" ? "NO" : "YES"]));
    const checklist = await api("POST", "/nom/me/telework/checklist", {
      token: worker.token,
      body: { answers: allYes },
    });
    expectStatus(checklist, 201, "checklist inicial");
    assert.equal(checklist.body?.kind, "INITIAL");

    const periodic = await api("POST", "/nom/me/telework/checklist", {
      token: worker.token,
      body: { kind: "PERIODIC", answers: allYes },
    });
    expectStatus(periodic, 201, "checklist periódico");
    assert.equal(periodic.body?.kind, "PERIODIC");

    const meAfter = await api("GET", "/nom/me/telework", { token: worker.token });
    assert.equal(meAfter.body?.lastChecklist?.kind, "PERIODIC");
    assert.ok(meAfter.body?.nextPeriodicDueAt, "calcula el siguiente checklist periódico");

    const checklists = await api("GET", "/nom/telework/checklists", { token: hr.token });
    expectStatus(checklists, 200, "checklists del cliente");
    assert.ok((checklists.body as unknown[]).length >= 2);
  });

  test("comunicación fuera de jornada: se marca, se audita y se avisa al trabajador", async () => {
    const tenant = await createTenant();
    const hr = await clientSession("HUMAN_RESOURCES", { tenant });
    const employee = await createUser({
      tenantId: tenant.id,
      role: "CLIENT_STAFF",
      employeeNumber: unique("E"),
    });
    const worker = await login({ username: employee.username, tenant: tenant.slug });

    const contact = await api("POST", "/nom/telework/out-of-hours-contacts", {
      token: hr.token,
      body: {
        userId: employee.id,
        channel: "CALL",
        reason: "Llamada de urgencia por caída del sistema",
      },
    });
    expectStatus(contact, 201, "contacto fuera de jornada");
    assert.equal(contact.body?.notifiedEmployee, true);

    const contacts = await api("GET", "/nom/telework/out-of-hours-contacts", {
      token: hr.token,
    });
    expectStatus(contacts, 200, "lista de contactos");
    assert.ok((contacts.body as Array<{ id: string }>).some((row) => row.id === contact.body?.id));

    // El trabajador recibe el aviso en la campanita.
    const notifications = await api("GET", "/notifications", { token: worker.token });
    expectStatus(notifications, 200, "notificaciones del trabajador");
    assert.ok(
      ((notifications.body?.data ?? []) as Array<{ type: string }>).some(
        (row) => row.type === "OUT_OF_HOURS_CONTACT"
      ),
      "aviso in-app de contacto fuera de jornada"
    );
  });

  test("RH de otro cliente no puede registrar ni dar teletrabajo a un empleado ajeno", async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    const employee = await createUser({ tenantId: tenantA.id, role: "CLIENT_STAFF" });
    const hrB = await clientSession("HUMAN_RESOURCES", { tenant: tenantB });

    const cross = await api("POST", "/nom/telework/registrations", {
      token: hrB.token,
      body: { userId: employee.id },
    });
    expectError(cross, 404, "USER_NOT_FOUND", "teletrabajo cross-tenant");

    const crossContact = await api("POST", "/nom/telework/out-of-hours-contacts", {
      token: hrB.token,
      body: { userId: employee.id, channel: "MESSAGE", reason: "Contacto cruzado" },
    });
    expectError(crossContact, 404, "USER_NOT_FOUND", "contacto cross-tenant");
  });
});
