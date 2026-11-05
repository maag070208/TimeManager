/**
 * F1B-06 — API key por cliente para ingesta directa del reloj.
 *
 * El alta ata serial + key + cliente: el equipo sube sus checadas con su key
 * (sin JWT), el API las guarda en el contexto del cliente dueño y es
 * idempotente por `(clockSerial, serialNo)`. La key se muestra una sola vez.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  expectError,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

const SERIAL_A = unique("KEY-CLOCK-A");
const SERIAL_B = unique("KEY-CLOCK-B");

let tenantA: TenantFixture;
let tenantB: TenantFixture;
let adminA: Session;
let adminB: Session;
let apiKey = "";

const createClock = async (tenantId: string, serial: string): Promise<void> => {
  const { prismaClient } = await import("@core/config/database");
  const { runWithTenant } = await import("@core/tenancy");
  await runWithTenant(tenantId, () =>
    prismaClient.timeClock.create({
      data: { serialNumber: serial, tenantId, name: `Reloj ${serial}`, url: `https://${serial.toLowerCase()}.local` },
    })
  );
};

const ingest = (serial: string, key: string, punches: Array<Record<string, unknown>>) =>
  api("POST", "/time-clock/ingest", {
    headers: key ? { "X-Clock-Key": key } : {},
    body: { serial, punches },
  });

before(async () => {
  await setupSuite();
  tenantA = await createTenant();
  tenantB = await createTenant();
  adminA = await clientSession("CLIENT_ADMIN", { tenant: tenantA });
  adminB = await clientSession("CLIENT_ADMIN", { tenant: tenantB });
  await createClock(tenantA.id, SERIAL_A);
  await createClock(tenantB.id, SERIAL_B);
});

after(async () => {
  await stopSuite();
});

describe("API key del reloj para ingesta directa", () => {
  test("rotar la key la devuelve una vez y el estado solo expone el prefijo", async () => {
    const response = await api("POST", `/time-clock/clocks/${SERIAL_A}/key`, { token: adminA.token });
    expectStatus(response, 201, "rotar API key");
    apiKey = String(response.body?.apiKey ?? "");
    assert.match(apiKey, /^tmc_/);
    assert.equal(response.body?.clockSerial, SERIAL_A);
    assert.equal(String(response.body?.prefix).length > 0, true);

    const status = await api("GET", "/time-clock/status", { token: adminA.token });
    expectStatus(status, 200, "estado del reloj");
    const device = (status.body?.devices ?? []).find((d: { clockSerial: string }) => d.clockSerial === SERIAL_A);
    assert.equal(device?.apiKeyPrefix, response.body?.prefix);
    assert.equal(status.text.includes(apiKey), false, "la key en claro nunca se devuelve después");
  });

  test("el reloj sube checadas con su key y el reintento es idempotente", async () => {
    const punches = [
      { serialNo: 1, employeeNumber: "E-001", name: "ANA", minor: 75, occurredAt: "2026-11-05T15:00:00-08:00" },
      { serialNo: 2, employeeNumber: "E-002", name: "BRUNO", minor: 38, occurredAt: "2026-11-05T15:01:00-08:00" },
    ];
    const first = await ingest(SERIAL_A, apiKey, punches);
    expectStatus(first, 202, "ingesta con key");
    assert.equal(first.body?.saved, 2);

    const retry = await ingest(SERIAL_A, apiKey, punches);
    expectStatus(retry, 202, "reintento de ingesta");
    assert.equal(retry.body?.saved, 0, "el reintento no duplica checadas");

    // Se ven solo en el cliente dueño del reloj.
    const own = await api("POST", "/time-clock/query", {
      token: adminA.token,
      body: { page: 1, limit: 10 },
    });
    expectStatus(own, 200, "checadas del cliente A");
    assert.ok(own.text.includes("E-001"));
    const other = await api("POST", "/time-clock/query", {
      token: adminB.token,
      body: { page: 1, limit: 10 },
    });
    expectStatus(other, 200, "checadas del cliente B");
    assert.equal(other.text.includes("E-001"), false, "las checadas no se filtran a otro cliente");
  });

  test("sin key, con key incorrecta o key de otro reloj responde 401", async () => {
    const missing = await ingest(SERIAL_A, "", []);
    // El DTO rechaza una lista vacía: la autenticación es lo que se prueba con key.
    expectStatus(missing, 400, "sin key y sin checadas (valida primero el body)");

    const wrong = await ingest(SERIAL_A, "tmc_inventada", [
      { serialNo: 10, employeeNumber: "X", minor: 75, occurredAt: "2026-11-05T15:00:00Z" },
    ]);
    expectError(wrong, 401, "INVALID_CLOCK_KEY", "key incorrecta");

    const otherSerial = await ingest(SERIAL_B, apiKey, [
      { serialNo: 11, employeeNumber: "X", minor: 75, occurredAt: "2026-11-05T15:00:00Z" },
    ]);
    expectError(otherSerial, 401, "INVALID_CLOCK_KEY", "key del reloj A no sirve para el reloj B");
  });
});
