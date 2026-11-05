/**
 * F4-02 — rate limit por cliente además del de IP.
 *
 * Dos clientes con el mismo endpoint caro: agotar el tope de uno NO afecta al
 * otro. Los anónimos/plataforma se limitan por IP (incluye la ingesta del reloj
 * y el push del agente).
 */
process.env.RATE_LIMIT_DISABLED = "false";
process.env.RATE_LIMIT_PER_TENANT = "4";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_QUERY_MAX = "10000";
process.env.RATE_LIMIT_LOGIN_MAX = "100";

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createTenant,
  expectStatus,
  setupSuite,
  stopSuite,
  type Session,
  type TenantFixture,
} from "./harness";

let tenantA: TenantFixture;
let tenantB: TenantFixture;
let adminA: Session;
let adminB: Session;

const query = (session: Session) =>
  api("POST", "/time-clock/query", { token: session.token, body: { page: 1, limit: 5 } });

before(async () => {
  await setupSuite();
  tenantA = await createTenant();
  tenantB = await createTenant();
  adminA = await clientSession("CLIENT_ADMIN", { tenant: tenantA });
  adminB = await clientSession("CLIENT_ADMIN", { tenant: tenantB });
});

after(async () => {
  await stopSuite();
});

describe("rate limit por cliente", () => {
  test("el cliente A agota su tope y el cliente B sigue respondiendo", async () => {
    let limited = false;
    for (let attempt = 0; attempt < 10 && !limited; attempt += 1) {
      const response = await query(adminA);
      if (response.status === 429) {
        limited = true;
        assert.equal(response.body?.code, "TOO_MANY_REQUESTS");
      } else {
        expectStatus(response, 200, "consulta del cliente A dentro del tope");
      }
    }
    assert.equal(limited, true, "el cliente A debe quedar limitado");

    const other = await query(adminB);
    expectStatus(other, 200, "el cliente B no debe verse afectado");
  });

  test("la ingesta anónima del reloj también queda limitada por IP", async () => {
    let limited = false;
    for (let attempt = 0; attempt < 10 && !limited; attempt += 1) {
      const response = await api("POST", "/time-clock/ingest", {
        body: { serial: "NO-EXISTE", punches: [{ serialNo: 1, employeeNumber: "X", minor: 75, occurredAt: "2026-11-05T15:00:00Z" }] },
        headers: { "X-Clock-Key": "clave-invalida" },
      });
      if (response.status === 429) {
        limited = true;
        assert.equal(response.body?.code, "TOO_MANY_REQUESTS");
      } else {
        expectStatus(response, 401, "ingesta sin key válida");
      }
    }
    assert.equal(limited, true, "la ingesta anónima debe limitarse por IP");
  });
});
