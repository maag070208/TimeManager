/**
 * F4-02 — paginación por cursor en los `POST /query`.
 *
 * El cursor es opaco (base64url del último renglón) y compatible con el offset:
 * sin `cursor` la respuesta es la de siempre. Probado en checadas (orden
 * occurredAt desc) y usuarios (createdAt desc).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  api,
  clientSession,
  createPunch,
  createUser,
  createTenant,
  expectStatus,
  setupSuite,
  stopSuite,
  unique,
  type Session,
  type TenantFixture,
} from "./harness";

let tenant: TenantFixture;
let admin: Session;

const DASHBOARD = new Date("2026-10-01T15:00:00.000Z").getTime();

before(async () => {
  await setupSuite();
  tenant = await createTenant();
  admin = await clientSession("CLIENT_ADMIN", { tenant });
  // 25 checadas en instantes distintos (orden estable por occurredAt desc).
  for (let i = 0; i < 25; i += 1) {
    await createPunch(tenant.id, {
      employeeNumber: unique("EMP"),
      name: `PERSONA ${i}`,
      serialNo: 1000 + i,
      occurredAt: new Date(DASHBOARD + i * 60_000),
    });
  }
  // 12 cuentas para el directorio.
  for (let i = 0; i < 12; i += 1) {
    await createUser({ tenantId: tenant.id, role: "CLIENT_STAFF", username: unique("cursor") });
  }
});

after(async () => {
  await stopSuite();
});

describe("cursor en /query", () => {
  test("checadas: la página por cursor no repite renglones y respeta el tope", async () => {
    const first = await api("POST", "/time-clock/query", {
      token: admin.token,
      body: { page: 1, limit: 10 },
    });
    expectStatus(first, 200, "primera página de checadas");
    const firstRows = (first.body?.data ?? []) as Array<{ id: string; serialNo: number }>;
    assert.equal(firstRows.length, 10);
    assert.equal(typeof first.body?.nextCursor, "string", "debe devolver nextCursor");

    const second = await api("POST", "/time-clock/query", {
      token: admin.token,
      body: { cursor: first.body?.nextCursor, limit: 10 },
    });
    expectStatus(second, 200, "segunda página de checadas");
    const secondRows = (second.body?.data ?? []) as Array<{ id: string; serialNo: number }>;
    assert.equal(secondRows.length, 10);
    const firstIds = new Set(firstRows.map((row) => row.id));
    assert.equal(secondRows.some((row) => firstIds.has(row.id)), false, "el cursor no repite filas");
    assert.ok(
      Math.max(...secondRows.map((row) => row.serialNo)) < Math.min(...firstRows.map((row) => row.serialNo)),
      "la segunda página sigue el orden occurredAt desc"
    );
  });

  test("usuarios: la página por offset anuncia el cursor y la siguiente no repite", async () => {
    const offset = await api("POST", "/users/query", {
      token: admin.token,
      body: { page: 1, limit: 5 },
    });
    expectStatus(offset, 200, "usuarios por offset");
    const firstIds = new Set(((offset.body?.data ?? []) as Array<{ id: string }>).map((row) => row.id));
    assert.equal(firstIds.size, 5);
    assert.equal(typeof offset.body?.nextCursor, "string", "la página offset anuncia nextCursor");

    const cursorPage = await api("POST", "/users/query", {
      token: admin.token,
      body: { cursor: offset.body?.nextCursor, limit: 5 },
    });
    expectStatus(cursorPage, 200, "usuarios página por cursor");
    const cursorIds = ((cursorPage.body?.data ?? []) as Array<{ id: string }>).map((row) => row.id);
    assert.ok(cursorIds.length > 0);
    assert.equal(cursorIds.some((id) => firstIds.has(id)), false, "el cursor no repite usuarios");
  });

  test("un cursor corrupto cae a offset sin romper", async () => {
    const response = await api("POST", "/time-clock/query", {
      token: admin.token,
      body: { page: 1, limit: 5, cursor: "no-es-un-cursor-valido!!" },
    });
    expectStatus(response, 200, "cursor inválido");
    assert.equal((response.body?.data ?? []).length, 5);
  });

  test("el límite máximo es server-side (200)", async () => {
    const response = await api("POST", "/time-clock/query", {
      token: admin.token,
      body: { page: 1, limit: 100000 },
    });
    expectStatus(response, 200, "tope de limit");
    assert.equal(response.body?.limit, 200);
  });
});
