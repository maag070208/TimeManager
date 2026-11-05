/**
 * F1B-10 — Credenciales del reloj por reloj.
 *
 * Cada reloj guarda su propio usuario y contraseña (cifrados en BD). El alta y
 * la edición son write-only: el API nunca devuelve la contraseña, solo
 * `username` y `hasCredentials`. La sincronización usa las credenciales del
 * reloj contra el mock ISAPI local (`api/scripts/isapi-mock/server.ts`, usuario
 * `mock` / `mock-pass-123`): con las correctas conecta y trae checadas; con las
 * incorrectas responde 502 TIME_CLOCK_INVALID_CREDENTIALS. El par global del
 * `.env` solo es fallback para relojes sin credenciales propias.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import {
  api,
  clientSession,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
  type ApiJson,
  type ApiResponse,
  type Session,
} from "./harness";

const MOCK_URL = "http://127.0.0.1:4801";
const MOCK_USER = "mock";
const MOCK_PASS = "mock-pass-123";
const MOCK_SERIAL = "MOCK-SERIAL-0001";

let session: Session;
let mock: ChildProcess | null = null;
/** `false` si el reloj quedó con credenciales incorrectas al final (se restaura). */
let mockStartedByUs = false;

const mockIsUp = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${MOCK_URL}/__mock__/state`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
};

/** Levanta el mock ISAPI si no hay uno ya escuchando en 4801 (permite reutilizarlo). */
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

const waitFor = async <T>(label: string, read: () => Promise<T | null>, timeoutMs = 20_000): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null) return value;
    await sleep(150);
  }
  throw new Error(`Timeout esperando ${label}`);
};

interface Device extends ApiJson {
  clockSerial: string;
  username: string | null;
  hasCredentials: boolean;
  inProgress: ApiJson | null;
  lastRun: ApiJson | null;
  punches: number;
}

type StatusBody = ApiJson & { configured: boolean; devices: Device[] };

const status = async (): Promise<ApiResponse<StatusBody>> =>
  api<StatusBody>("GET", "/time-clock/status", { token: session.token });

/** El reloj del mock, o `null` mientras haya una corrida en curso. */
const readyDevice = async (): Promise<Device | null> => {
  const response = await status();
  expectStatus(response, 200, "GET /time-clock/status");
  const device = response.body!.devices.find((d) => d.clockSerial === MOCK_SERIAL);
  assert.ok(device, `El reloj ${MOCK_SERIAL} debe estar dado de alta`);
  return device.inProgress !== null ? null : device;
};

const assertNoPasswordLeak = (response: ApiResponse, label: string): void => {
  assert.equal(/password/i.test(response.text), false, `${label}: la respuesta no debe incluir password`);
  assert.equal(/passwordEncrypted/i.test(response.text), false, `${label}: la respuesta no debe incluir passwordEncrypted`);
};

const createClock = (body: Record<string, unknown>): Promise<ApiResponse> =>
  api("POST", "/time-clock/clocks", { token: session.token, body });

const patchClock = (body: Record<string, unknown>): Promise<ApiResponse> =>
  api("PATCH", `/time-clock/clocks/${MOCK_SERIAL}`, { token: session.token, body });

before(async () => {
  await setupSuite();
  await ensureMock();
  session = await clientSession("CLIENT_ADMIN");
});

after(async () => {
  // Cualquier corrida en curso termina contra el mock; después se cierra todo.
  if (mock && mockStartedByUs && mock.exitCode === null) {
    mock.kill("SIGTERM");
    mock = null;
  }
  await stopSuite();
});

describe("credenciales del reloj", () => {
  test("alta con contraseña incorrecta: 502 TIME_CLOCK_INVALID_CREDENTIALS y no queda el reloj", async () => {
    const response = await createClock({ url: MOCK_URL, username: MOCK_USER, password: "contraseña-incorrecta" });
    expectError(response, 502, "TIME_CLOCK_INVALID_CREDENTIALS", "alta del reloj con credenciales incorrectas");
    assertNoPasswordLeak(response, "alta fallida");
    const current = await status();
    expectStatus(current, 200, "status después del alta fallida");
    assert.equal(current.body!.devices.length, 0, "un alta fallida no debe dejar el reloj");
  });

  test("alta con las credenciales del reloj: 201, username y hasCredentials, sin contraseña", async () => {
    const response = await createClock({ url: MOCK_URL, name: "Reloj mock", username: MOCK_USER, password: MOCK_PASS });
    expectStatus(response, 201, "alta del reloj");
    assert.equal(response.body?.clockSerial, MOCK_SERIAL);
    assert.equal(response.body?.username, MOCK_USER);
    assert.equal(response.body?.hasCredentials, true);
    assertNoPasswordLeak(response, "alta del reloj");
  });

  test("la contraseña se guarda cifrada y el estado no la filtra", async () => {
    const { prismaClient } = await import("@core/config/database");
    const { runWithTenant } = await import("@core/tenancy/context");
    const row = await runWithTenant(session.tenant!.id, () =>
      prismaClient.timeClock.findUnique({ where: { serialNumber: MOCK_SERIAL } })
    );
    assert.ok(row, "el reloj debe existir");
    assert.equal(row.username, MOCK_USER);
    assert.ok(row.passwordEncrypted, "la contraseña debe quedar guardada");
    assert.notEqual(row.passwordEncrypted, MOCK_PASS, "la contraseña no puede quedar en claro");
    const { decryptSecret } = await import("@core/utils/crypto");
    assert.equal(decryptSecret(row.passwordEncrypted!), MOCK_PASS, "la contraseña cifrada debe descifrarse");

    const response = await status();
    expectStatus(response, 200, "status");
    assertNoPasswordLeak(response, "GET /time-clock/status");
    const device = response.body!.devices[0];
    assert.equal(device.username, MOCK_USER);
    assert.equal(device.hasCredentials, true);
    assert.equal(response.body!.configured, true);
  });

  test("la edición cambia las credenciales (write-only) sin devolverlas", async () => {
    const renamed = await patchClock({ name: "Reloj mock renombrado" });
    expectStatus(renamed, 200, "PATCH nombre");
    assert.equal(renamed.body?.name, "Reloj mock renombrado");
    assert.equal(renamed.body?.hasCredentials, true);
    assertNoPasswordLeak(renamed, "PATCH nombre");

    const passwordOnly = await patchClock({ password: MOCK_PASS });
    expectStatus(passwordOnly, 200, "PATCH solo contraseña (mismo usuario guardado)");
    assert.equal(passwordOnly.body?.username, MOCK_USER);
    assert.equal(passwordOnly.body?.hasCredentials, true);
    assertNoPasswordLeak(passwordOnly, "PATCH contraseña");
  });

  test("sync con la contraseña del reloj incorrecta: 502 TIME_CLOCK_INVALID_CREDENTIALS", async () => {
    await waitFor("que termine la corrida del alta", readyDevice);
    const broken = await patchClock({ password: "otra-que-no-es" });
    expectStatus(broken, 200, "PATCH contraseña incorrecta");
    assertNoPasswordLeak(broken, "PATCH contraseña incorrecta");

    const sync = await api("POST", "/time-clock/sync", { token: session.token });
    expectError(sync, 502, "TIME_CLOCK_INVALID_CREDENTIALS", "sync con credenciales del reloj incorrectas");
    assertNoPasswordLeak(sync, "sync fallido");

    const restored = await patchClock({ username: MOCK_USER, password: MOCK_PASS });
    expectStatus(restored, 200, "PATCH credenciales correctas");
    const device = await waitFor("que el reloj quede listo", readyDevice);
    assert.equal(device.hasCredentials, true);
  });

  test("sync con las credenciales del reloj: conecta y guarda sus checadas", async () => {
    const beforeSync = await waitFor("que no haya corridas en curso", readyDevice);
    assert.equal(beforeSync.hasCredentials, true);
    const previousFinishedAt = beforeSync.lastRun?.finishedAt ?? null;
    const sync = await api("POST", "/time-clock/sync", { token: session.token });
    expectStatus(sync, 202, "sync con credenciales del reloj correctas");

    const finished = await waitFor("que termine el sync", async () => {
      const device = await readyDevice();
      if (!device.lastRun || device.lastRun.finishedAt === previousFinishedAt) return null;
      return device.lastRun.ok === true ? device : null;
    });
    assert.equal(finished.hasCredentials, true);
    assert.equal(finished.username, MOCK_USER);
    assert.ok(finished.punches > 0, "el sync debe haber guardado checadas del mock");

    // Las checadas del reloj del tenant quedaron aisladas para su cliente.
    const punches = await api("POST", "/time-clock/query", { token: session.token, body: { page: 1, limit: 10 } });
    expectStatus(punches, 200, "POST /time-clock/query");
    const rows = (punches.body?.data ?? []) as Array<{ clockSerial: string }>;
    assert.ok(rows.length > 0);
    assert.equal(rows.every((row) => row.clockSerial === MOCK_SERIAL), true);
  });
});
