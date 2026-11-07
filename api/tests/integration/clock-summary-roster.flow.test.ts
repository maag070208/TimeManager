/**
 * Integración relojes ↔ mock ISAPI: resumen/dashboard, cursor de sync e
 * idempotencia, serial distinto y padrón (roster) con vincular/desvincular.
 *
 * Usa el mock local (`scripts/isapi-mock/server.ts`, 127.0.0.1:4801; lo levanta
 * si no está arriba) y una BD local `tm_test_*`. Cubre, entre otros:
 * CLK-01, CLK-03, CLK-04, CLK-06, CLK-06-T1, CLK-06-T6, CLK-09, ACT-29,
 * ACT-30, ACT-31, ACT-36 y CLK-M05.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
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
  type ApiJson,
  type ApiResponse,
  type Session,
  type TenantFixture,
} from "./harness";

const MOCK_URL = "http://127.0.0.1:4801";
const MOCK_USER = "mock";
const MOCK_PASS = "mock-pass-123";
const MOCK_SERIAL = "MOCK-SERIAL-0001";

let mock: ChildProcess | null = null;
let mockStartedByUs = false;

let tenant: TenantFixture;
let admin: Session;
let otherTenant: TenantFixture;
let otherAdmin: Session;

// ── Mock ISAPI ─────────────────────────────────────────────────────────────

const mockIsUp = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${MOCK_URL}/__mock__/state`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
};

const ensureMock = async (): Promise<void> => {
  if (await mockIsUp()) return;
  const apiDir = path.resolve(__dirname, "../..");
  const child = spawn(
    process.execPath,
    [
      "--require",
      "ts-node/register/transpile-only",
      "--require",
      "tsconfig-paths/register",
      "scripts/isapi-mock/server.ts",
    ],
    { cwd: apiDir, stdio: ["ignore", "pipe", "pipe"] }
  );
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
  mock = child;
  mockStartedByUs = true;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`El mock ISAPI no arrancó (exit ${child.exitCode}): ${stderr.slice(0, 500)}`);
    }
    if (await mockIsUp()) return;
    await sleep(200);
  }
  throw new Error(`El mock ISAPI no respondió en ${MOCK_URL}: ${stderr.slice(0, 500)}`);
};

// ── Helpers de estado del reloj ────────────────────────────────────────────

interface Device extends ApiJson {
  clockSerial: string;
  connection?: string;
  model: string | null;
  url: string;
  inProgress: ApiJson | null;
  lastRun: ApiJson | null;
  punches: number;
  pausedByCredentials: boolean;
}

type StatusBody = ApiJson & { configured: boolean; devices: Device[] };

const status = async (session: Session = admin): Promise<ApiResponse<StatusBody>> =>
  api<StatusBody>("GET", "/time-clock/status", { token: session.token });

const waitIdle = async (timeoutMs = 20_000): Promise<Device> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await status();
    expectStatus(response, 200, "status del reloj");
    const device = response.body!.devices.find((d) => d.clockSerial === MOCK_SERIAL);
    if (device && device.inProgress === null && device.lastRun !== null) return device;
    await sleep(150);
  }
  throw new Error("Timeout esperando que el reloj termine su sincronización");
};

const db = async () => (await import("@core/config/database")).prismaClient;
const withTenant = async <T>(tenantId: string, fn: () => Promise<T>): Promise<T> => {
  const { runWithTenant } = await import("@core/tenancy");
  return runWithTenant(tenantId, fn);
};

const countPunches = async (): Promise<number> => {
  const client = await db();
  return withTenant(tenant.id, () => client.timeClockPunch.count({ where: { clockSerial: MOCK_SERIAL } }));
};

before(async () => {
  await setupSuite();
  await ensureMock();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  otherTenant = await createTenant();
  otherAdmin = await clientSession("CLIENT_ADMIN", { tenant: otherTenant });

  // Alta real contra el mock (lee identidad y credenciales antes de guardar).
  const register = await api("POST", "/time-clock/clocks", {
    token: admin.token,
    body: { url: MOCK_URL, name: "Reloj mock", username: MOCK_USER, password: MOCK_PASS },
  });
  expectStatus(register, 201, "alta del reloj mock");
  assert.equal(register.body?.clockSerial, MOCK_SERIAL);
});

after(async () => {
  if (mock && mockStartedByUs && mock.exitCode === null) {
    mock.kill("SIGTERM");
    mock = null;
  }
  await stopSuite();
});

// ── Resumen / dashboard ────────────────────────────────────────────────────

describe("resumen y dashboard con el reloj mock", () => {
  test("[CLK-06][CLK-06-T1][ACT-29] el resumen muestra el equipo en línea y sus conteos", async () => {
    await waitIdle();
    const summary = await api("GET", "/time-clock/summary", { token: admin.token });
    expectStatus(summary, 200, "GET /time-clock/summary");
    const row = (summary.body?.clocks ?? []).find((c: { serial: string }) => c.serial === MOCK_SERIAL);
    assert.ok(row, "el resumen debe incluir el reloj dado de alta");
    assert.equal(row.connection, "ONLINE", "el mock responde: conexión en línea");
    assert.equal(row.device?.model, "DS-K1T320MFWX");
    assert.equal(row.counts?.people, 8, "el mock tiene 8 personas");
    assert.equal(Array.isArray(row.alerts), true);
  });

  test("[CLK-06-T6][CLK-09][ACT-29] status y settings leen la identidad del equipo", async () => {
    const current = await waitIdle();
    assert.equal(current.pausedByCredentials, false);
    assert.equal(typeof current.lastRun?.lastSerialNo, "number");

    const settings = await api("GET", `/time-clock/clocks/${MOCK_SERIAL}/settings`, { token: admin.token });
    expectStatus(settings, 200, "GET settings");
    assert.equal(settings.body?.device?.model, "DS-K1T320MFWX");
    assert.equal(typeof settings.body?.hour?.driftSeconds, "number");
    assert.equal(settings.body?.people?.total, 8);
  });

  test("[CLK-M01] el historial guarda la corrida de sincronización", async () => {
    await waitIdle();
    const history = await api("GET", `/time-clock/clocks/${MOCK_SERIAL}/events`, { token: admin.token });
    expectStatus(history, 200, "GET events");
    assert.ok((history.body?.events ?? []).length >= 1, "debe haber al menos un intento guardado");
    assert.equal(history.body?.summary?.okCount >= 1, true);
  });
});

// ── Sync: cursor e idempotencia ────────────────────────────────────────────

describe("sincronización: cursor e idempotencia", () => {
  test("[CLK-01][ACT-29] un segundo sync no vuelve a traer las mismas checadas", async () => {
    const before = await waitIdle();
    const previousPunches = await countPunches();
    const previousFinishedAt = before.lastRun?.finishedAt;
    const previousLastSerialNo = before.lastRun?.lastSerialNo;

    const sync = await api("POST", "/time-clock/sync", { token: admin.token });
    expectStatus(sync, 202, "POST /time-clock/sync");

    const deadline = Date.now() + 20_000;
    let after = await waitIdle();
    while (after.lastRun?.finishedAt === previousFinishedAt && Date.now() < deadline) {
      await sleep(150);
      after = await waitIdle();
    }

    assert.equal(after.lastRun?.ok, true, "la segunda corrida debe terminar bien");
    assert.equal(after.lastRun?.newCount, 0, "el cursor no debe repetir checadas");
    assert.equal(after.lastRun?.lastSerialNo, previousLastSerialNo, "el cursor no avanza sin eventos nuevos");
    assert.equal(await countPunches(), previousPunches, "el conteo de checadas no cambia");
  });

  test("[CLK-09][ACT-29] un serial distinto en la BD responde 409 TIME_CLOCK_SERIAL_CHANGED", async () => {
    const client = await db();
    const { encryptSecret } = await import("@core/utils/crypto");
    const foreignSerial = unique("OTRO-SERIAL");
    await withTenant(otherTenant.id, () =>
      client.timeClock.create({
        data: {
          serialNumber: foreignSerial,
          tenantId: otherTenant.id,
          name: "Reloj con serial viejo",
          url: MOCK_URL,
          countsAttendance: true,
          username: MOCK_USER,
          passwordEncrypted: encryptSecret(MOCK_PASS),
        },
      })
    );
    const response = await api("GET", `/time-clock/clocks/${foreignSerial}/settings`, {
      token: otherAdmin.token,
    });
    expectError(response, 409, "TIME_CLOCK_SERIAL_CHANGED", "settings con serial distinto");
  });
});

// ── Roster ─────────────────────────────────────────────────────────────────

describe("padrón del reloj (roster)", () => {
  test("[CLK-03][ACT-30] revisar padrón guarda las personas del mock y las lista", async () => {
    await waitIdle();
    const run = await api("POST", "/time-clock/roster/run", { token: admin.token });
    expectStatus(run, 200, "POST /time-clock/roster/run");
    assert.equal(run.body?.ok, true, "la corrida del padrón debe ser ok");
    const perClock = (run.body?.perClock ?? []) as Array<{ serial: string; ok: boolean; count: number }>;
    const mockClock = perClock.find((c) => c.serial === MOCK_SERIAL);
    assert.ok(mockClock, "la corrida incluye el reloj mock");
    assert.equal(mockClock!.ok, true);
    assert.equal(mockClock!.count, 8, "el mock tiene 8 personas");

    const roster = await api("GET", "/time-clock/roster", { token: admin.token });
    expectStatus(roster, 200, "GET /time-clock/roster");
    assert.ok((roster.body?.lastRun?.id ?? roster.body?.lastRun) !== undefined, "debe haber última revisión");
    const unlinked = (roster.body?.unlinked ?? []) as Array<{ employeeNumber: string }>;
    assert.ok(unlinked.length >= 8, "las 8 personas del mock aparecen sin vínculo");
  });

  test("[CLK-03][ACT-30] aplicar baja con motivo desactiva al usuario", async () => {
    // Número del mock vinculado al usuario en baja pendiente.
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF", username: unique("roster-baja") });
    const client = await db();
    await withTenant(tenant.id, () =>
      client.timeClockEmployee.create({
        data: {
          tenantId: tenant.id,
          employeeNumber: "1000",
          userId: user.id,
          status: "PENDING_REMOVAL",
          missingRuns: 3,
          missingSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      })
    );
    const category = await withTenant(tenant.id, () =>
      client.removalCategory.create({
        data: { tenantId: tenant.id, key: unique("MOTIVO"), name: "Renuncia (QA)" },
        select: { id: true },
      })
    );

    const removal = await api("POST", "/time-clock/roster/employees/1000/removal", {
      token: admin.token,
      body: { categoryId: category.id, reason: "baja voluntaria del empleado", notifyUser: false },
    });
    expectStatus(removal, 200, "aplicar baja del padrón");

    const updatedUser = await withTenant(tenant.id, () =>
      client.user.findUnique({ where: { id: user.id }, select: { active: true } })
    );
    assert.equal(updatedUser?.active, false, "el usuario queda dado de baja");
    const link = await withTenant(tenant.id, () =>
      client.timeClockEmployee.findFirst({ where: { employeeNumber: "1000" }, select: { status: true } })
    );
    assert.equal(link?.status, "ACTIVE", "la baja pendiente se limpia del vínculo");
  });

  test("[CLK-03][ACT-30] descartar la baja deja al usuario activo", async () => {
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF", username: unique("roster-dismiss") });
    const client = await db();
    await withTenant(tenant.id, () =>
      client.timeClockEmployee.create({
        data: {
          tenantId: tenant.id,
          employeeNumber: "1001",
          userId: user.id,
          status: "PENDING_REMOVAL",
          missingRuns: 3,
          missingSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      })
    );
    const dismiss = await api("POST", "/time-clock/roster/employees/1001/dismiss", { token: admin.token });
    expectStatus(dismiss, 200, "descartar baja pendiente");
    const updatedUser = await withTenant(tenant.id, () =>
      client.user.findUnique({ where: { id: user.id }, select: { active: true } })
    );
    assert.equal(updatedUser?.active, true, "descartar no da de baja al usuario");
  });
});

// ── Vínculos persona ↔ reloj ───────────────────────────────────────────────

describe("vincular/desvincular números del reloj", () => {
  test("[CLK-04][CLK-M05][ACT-31] vincular y desvincular un número", async () => {
    const user = await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF", username: unique("link") });
    const linked = await api("PUT", "/time-clock/employees/1002", {
      token: admin.token,
      body: { userId: user.id },
    });
    expectStatus(linked, 200, "vincular número del reloj");
    assert.equal(linked.body?.link?.userId, user.id);
    assert.equal(linked.body?.employeeNumber, "1002");

    const client = await db();
    const row = await withTenant(tenant.id, () =>
      client.timeClockEmployee.findFirst({ where: { employeeNumber: "1002" }, select: { userId: true } })
    );
    assert.equal(row?.userId, user.id);

    const unlinked = await api("DELETE", "/time-clock/employees/1002", { token: admin.token });
    expectStatus(unlinked, 200, "desvincular número del reloj");
    const gone = await withTenant(tenant.id, () =>
      client.timeClockEmployee.findFirst({ where: { employeeNumber: "1002" }, select: { userId: true } })
    );
    assert.equal(gone, null, "el vínculo se elimina");
  });

  test("[CLK-04][ACT-31] vincular de un jalón las sugerencias de alta confianza", async () => {
    // El mock tiene "PERSONA PRUEBA OCHO" con número 1007; un usuario con ese
    // nombre y número de nómina genera una sugerencia ALTA (nombre + número).
    const client = await db();
    await withTenant(tenant.id, () =>
      client.user.create({
        data: {
          tenantId: tenant.id,
          username: unique("sugerido"),
          name: "PERSONA PRUEBA OCHO",
          password: "no-se-usa",
          role: "CLIENT_STAFF",
          employeeNumber: "1007",
        },
      })
    );
    const bulk = await api("POST", "/time-clock/employees/link-suggested", { token: admin.token });
    expectStatus(bulk, 200, "vincular sugerencias en lote");
    assert.ok((bulk.body?.linkedCount ?? 0) >= 1, "debe vincular al menos una sugerencia");
  });

  test("[CLK-04] la tabla de empleados del reloj reporta vínculos y sugerencias", async () => {
    const response = await api("POST", "/time-clock/employees/query", {
      token: admin.token,
      body: { page: 1, limit: 50 },
    });
    expectStatus(response, 200, "employees/query");
    const summary = response.body?.summary;
    assert.ok(summary.total >= 8, "los números del mock aparecen");
    assert.ok(summary.linkedCount >= 1, "el vínculo de la prueba anterior aparece");
  });
});
