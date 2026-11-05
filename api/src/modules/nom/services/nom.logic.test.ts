/**
 * Lógica pura del módulo NOM (sin BD): topes legales por año, corte de
 * retención, formato del export STPS y detección/idempotencia de alertas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Los servicios importan `@core/config/database` (Prisma); no se conecta en
// estas pruebas, pero `env.config` exige estas variables.
process.env.DATABASE_URL ??= "postgresql://postgres:test@127.0.0.1:55433/tm_test_nom";
process.env.PORT ??= "0";
process.env.JWT_SECRET ??= "unit-test-nom-secret";

const loadSettings = () => import("./nom-settings.service");
const loadRetention = () => import("./retention.service");
const loadExport = () => import("./stps-export.service");
const loadAlerts = () => import("./workday-alerts.service");

const workdayDay = (overrides: Record<string, unknown> = {}) => ({
  userId: "user-1",
  employeeName: "Ana",
  employeeNumber: "E-001",
  departmentId: null,
  departmentName: null,
  active: true,
  date: "2027-03-10",
  extraMin: 120,
  workedMin: 780,
  scheduledMin: 480,
  scheduleName: "Matutino",
  restDay: false,
  withoutSchedule: false,
  shift: "08:00-17:00",
  exitAt: null,
  ...overrides,
});

test("tope semanal legal por año: 48 h antes de 2027, 46 h 2027-2029, 40 h desde 2030", async () => {
  const { weeklyLimitForYear } = await loadSettings();
  assert.equal(weeklyLimitForYear(2026), 48 * 60);
  assert.equal(weeklyLimitForYear(2027), 46 * 60);
  assert.equal(weeklyLimitForYear(2029), 46 * 60);
  assert.equal(weeklyLimitForYear(2030), 40 * 60);
  assert.equal(weeklyLimitForYear(2035), 40 * 60);
});

test("corte de retención: resta meses sin desbordar el día del mes", async () => {
  const { retentionCutoff } = await loadRetention();
  assert.equal(
    retentionCutoff(new Date("2027-01-31T12:00:00.000Z"), 1).toISOString(),
    "2026-12-31T12:00:00.000Z"
  );
  assert.equal(
    retentionCutoff(new Date("2026-03-31T00:00:00.000Z"), 1).toISOString(),
    "2026-02-28T00:00:00.000Z"
  );
  assert.equal(
    retentionCutoff(new Date("2028-02-29T00:00:00.000Z"), 12).toISOString(),
    "2027-02-28T00:00:00.000Z"
  );
});

test("export STPS CSV: encabezado, filas, hash y nombre del archivo", async () => {
  const { StpsExportService } = await loadExport();
  const fakeDb = {
    tenant: {
      findUnique: async () => ({
        id: "tenant-1",
        name: "Demo",
        slug: "demo",
        timezone: "America/Mexico_City",
      }),
    },
    remotePunch: { findMany: async () => [] },
  };
  const fakeCalculator = {
    computeOvertimeDays: async () => ({
      days: [
        workdayDay({ date: "2027-03-11", workedMin: 500, employeeNumber: "E-002", employeeName: "Luis" }),
        workdayDay({ date: "2027-03-10", workedMin: 780 }),
      ],
      range: {
        start: new Date("2027-03-01T06:00:00.000Z"),
        end: new Date("2027-04-01T06:00:00.000Z"),
        timezone: "America/Mexico_City",
        period: "MONTH",
      },
    }),
  };
  const service = new StpsExportService(fakeDb as never, fakeCalculator as never);
  const csv = await service.export("tenant-1", {
    period: "MONTH",
    date: "2027-03-01",
    format: "csv",
    actorId: "actor-1",
  });

  assert.match(csv.filename, /^registro-jornada_demo_2027-03-01_2027-03-31\.csv$/);
  assert.equal(csv.rowCount, 2);
  assert.equal(csv.sha256.length, 64);
  assert.ok(csv.body.includes(`# sha256: ${csv.sha256}`));
  assert.ok(
    csv.body.includes(
      "fecha,numeroEmpleado,nombre,departamento,horario,turno,minutosTrabajados,minutosProgramados,minutosExtra,descanso,sinHorario,ultimaSalida"
    )
  );
  // Orden por fecha ascendente (10 antes que 11).
  const row10 = csv.body.indexOf("2027-03-10");
  const row11 = csv.body.indexOf("2027-03-11");
  assert.ok(row10 > 0 && row11 > row10, "las filas van ordenadas por fecha");

  const json = await service.export("tenant-1", {
    period: "MONTH",
    date: "2027-03-01",
    format: "json",
  });
  const parsed = JSON.parse(json.body) as {
    schemaVersion: string;
    sha256: string;
    totals: { people: number; workedMinutes: number };
    rows: unknown[];
  };
  assert.equal(parsed.schemaVersion, "stps-registro-jornada-v0");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.totals.people, 2);
  assert.equal(parsed.totals.workedMinutes, 1280);
});

test("alertas: detecta jornada > límite, avisa una sola vez y suma la semana", async () => {
  const { WorkdayAlertsService } = await loadAlerts();

  const config = {
    workdayLimitMinutes: 720,
    weeklyLimitMinutes: 2760,
    retentionMonths: null,
    source: { workdayLimit: "tenant", weeklyLimit: "tenant", retention: "disabled" },
    legal: { year: 2027, weeklyLimitMinutes: 2760, workdayLimitMinutes: 720 },
  };
  const store = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const fakeDb = {
    tenant: { findUnique: async () => ({ timezone: "America/Mexico_City" }) },
    workdayLimitAlert: {
      findUnique: async ({ where }: { where: { tenantId_userId_scope_date: { userId: string; scope: string; date: Date } } }) => {
        const key = `${where.tenantId_userId_scope_date.userId}|${where.tenantId_userId_scope_date.scope}|${where.tenantId_userId_scope_date.date.toISOString()}`;
        return store.get(key) ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        seq += 1;
        const row = { id: `alert-${seq}`, notifyCount: 0, notifiedAt: new Date(), createdAt: new Date(), ...data };
        const key = `${data.userId}|${data.scope}|${(data.date as Date).toISOString()}`;
        store.set(key, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const [key, row] of store.entries()) {
          if (row.id === where.id) store.set(key, { ...row, ...data });
        }
        return null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        for (const row of store.values()) if (row.id === where.id) return { ...row, user: { name: "Ana", employeeNumber: "E-001" } };
        throw new Error("not found");
      },
    },
  };
  const fakeSettings = { resolve: async () => config };
  const notified: Array<{ employeeName: string; scope: string; workedMinutes: number }> = [];
  const fakeNotifications = {
    notifyWorkdayLimit: async (input: { employeeName: string; scope: string; workedMinutes: number }) => {
      notified.push(input);
      return { count: 2, recipientIds: ["hr-1", "hr-2"] };
    },
  };
  const audits: Array<{ action: string }> = [];
  const service = new WorkdayAlertsService(
    fakeDb as never,
    { computeOvertimeDays: async () => ({ days: [workdayDay()], range: {} as never }) } as never,
    fakeSettings as never,
    fakeNotifications as never,
    (async (input: { action: string }) => {
      audits.push(input);
      return undefined;
    }) as never
  );

  const first = await service.scan("tenant-1", { date: "2027-03-10", scope: "DAY" });
  assert.equal(first.created.length, 1);
  assert.equal(first.created[0].workedMinutes, 780);
  assert.equal(notified.length, 1);
  assert.equal(audits.filter((a) => a.action === "WORKDAY_LIMIT_ALERT").length, 1);

  // Segundo barrido del mismo día: no duplica ni vuelve a avisar.
  const second = await service.scan("tenant-1", { date: "2027-03-10", scope: "DAY" });
  assert.equal(second.created.length, 0);
  assert.equal(notified.length, 1);

  // Semana: dos días de 1200 min suman 2400 (< 2760) → no alerta semanal.
  const weekDays = [
    workdayDay({ date: "2027-03-10", workedMin: 1200 }),
    workdayDay({ date: "2027-03-11", workedMin: 1200 }),
  ];
  const weekService = new WorkdayAlertsService(
    fakeDb as never,
    {
      computeOvertimeDays: async () => ({
        days: weekDays,
        range: { start: new Date("2027-03-08T06:00:00.000Z"), end: new Date("2027-03-15T06:00:00.000Z") },
      }),
    } as never,
    fakeSettings as never,
    fakeNotifications as never,
    undefined
  );
  const week = await weekService.scan("tenant-1", { date: "2027-03-10", scope: "WEEK" });
  assert.equal(week.created.length, 0);

  // Un día de 3000 min sí excede el tope semanal.
  const heavyService = new WorkdayAlertsService(
    fakeDb as never,
    {
      computeOvertimeDays: async () => ({
        days: [workdayDay({ date: "2027-03-10", workedMin: 3000 })],
        range: { start: new Date("2027-03-08T06:00:00.000Z"), end: new Date("2027-03-15T06:00:00.000Z") },
      }),
    } as never,
    fakeSettings as never,
    fakeNotifications as never,
    undefined
  );
  const heavy = await heavyService.scan("tenant-1", { date: "2027-03-10", scope: "WEEK" });
  assert.equal(heavy.created.length, 1);
  assert.equal(heavy.created[0].scope, "WEEK");
  assert.equal(heavy.created[0].limitMinutes, 2760);
});

test("plantilla del checklist de teletrabajo (NOM-037): 8 puntos únicos", async () => {
  const { TeleworkService, TELEWORK_CHECKLIST_ITEMS } = await import("./telework.service");
  const service = new TeleworkService({} as never, {} as never);
  const template = service.checklistTemplate();
  assert.equal(template.version, 1);
  assert.equal(template.items.length, 8);
  assert.equal(new Set(template.items).size, template.items.length);
  assert.deepEqual(template.items, [...TELEWORK_CHECKLIST_ITEMS]);
  assert.ok(template.items.includes("electrical_safety"));
  assert.ok(template.items.includes("no_risk_conditions"));
});
