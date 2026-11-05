/**
 * Infraestructura local-first (F1B-01/02/03, F1C-03, F4-03):
 *
 * - RLS: las políticas de Postgres aíslan por `app.tenant_id` incluso para un
 *   rol sin BYPASSRLS; la app (con RLS_ENABLED=true) fija la variable por
 *   transacción. Aquí se prueba la política con un rol restringido real.
 * - Lock de líder de workers: con dos "procesos" (dos clientes Prisma) solo uno
 *   toma el lock; el heartbeat caducado permite la toma.
 * - Producción/observabilidad: request-id de correlación, /metrics protegido y
 *   rate limiting de login.
 */
process.env.RLS_ENABLED = "true";
process.env.RATE_LIMIT_DISABLED = "false";
process.env.RATE_LIMIT_LOGIN_MAX = "3";
process.env.RATE_LIMIT_WINDOW_MS = "60000";

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  api,
  clientSession,
  createDepartment,
  DEFAULT_PASSWORD,
  createTenant,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
  type Session,
} from "./harness";

const RLS_ROLE = "tm_rls_probe";
const RLS_PASSWORD = "rls-probe-pass";

let platform: Session;
let client: Session;
let db: PrismaClient;

const testDatabaseUrl = (): string => {
  const url = new URL(process.env.DATABASE_URL as string);
  url.username = RLS_ROLE;
  url.password = RLS_PASSWORD;
  return url.toString();
};

const createProbeRole = async (): Promise<boolean> => {
  try {
    const exists = await db.$queryRawUnsafe<Array<{ one: number }>>(
      "SELECT 1 AS one FROM pg_roles WHERE rolname = $1",
      RLS_ROLE
    );
    if (exists.length === 0) {
      await db.$executeRawUnsafe(`CREATE ROLE "${RLS_ROLE}" LOGIN PASSWORD '${RLS_PASSWORD}' NOBYPASSRLS NOSUPERUSER`);
    } else {
      await db.$executeRawUnsafe(`ALTER ROLE "${RLS_ROLE}" LOGIN PASSWORD '${RLS_PASSWORD}' NOBYPASSRLS`);
    }
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${RLS_ROLE}"`);
    await db.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${RLS_ROLE}"`);
    return true;
  } catch {
    // Una BD gestionada donde el usuario de pruebas no puede crear roles: se
    // omite solo la prueba de RLS a nivel BD (la de la app sigue corriendo).
    return false;
  }
};

const dropProbeRole = async (): Promise<void> => {
  try {
    await db.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${RLS_ROLE}"`).catch(() => undefined);
    await db.$executeRawUnsafe(`REVOKE ALL ON SCHEMA public FROM "${RLS_ROLE}"`).catch(() => undefined);
    await db.$executeRawUnsafe(`DROP ROLE IF EXISTS "${RLS_ROLE}"`);
  } catch {
    // La limpieza del rol best-effort no debe hacer fallar la suite.
  }
};

before(async () => {
  await setupSuite();
  const { prismaClient } = await import("@core/config/database");
  db = prismaClient;
  platform = await platformSession("ADMIN");
  client = await clientSession("CLIENT_ADMIN");
});

after(async () => {
  await stopSuite();
});

describe("RLS por cliente en Postgres", () => {
  test("las tablas de cliente tienen política y FORCE RLS", async () => {
    const policies = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM pg_policies WHERE policyname = 'tenant_isolation'`
    );
    assert.ok(Number(policies[0].count) >= 20, `esperaba >= 20 políticas, hay ${policies[0].count}`);
    const forced = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relrowsecurity AND c.relforcerowsecurity`
    );
    assert.ok(Number(forced[0].count) >= 20, "las tablas de cliente deben tener RLS forzado");
  });

  test("un rol sin BYPASSRLS solo ve el cliente de app.tenant_id", async (t) => {
    if (!(await createProbeRole())) {
      t.diagnostic("sin privilegios para crear el rol de prueba: se omite la prueba de RLS a nivel BD");
      return;
    }
    const tenantA = await createTenant();
    const tenantB = await createTenant();
    await createDepartment(tenantA.id, "RLS A");
    await createDepartment(tenantB.id, "RLS B");
    const probe = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
    try {
      // Sin `app.tenant_id` la política es fail-closed: cero filas.
      const withoutContext = await probe.$queryRawUnsafe<Array<{ n: bigint }>>(
        'SELECT count(*)::bigint AS n FROM "departments"'
      );
      assert.equal(Number(withoutContext[0].n), 0, "sin contexto de cliente no debe ver ninguna fila");

      // Con el cliente fijado en la transacción ve solo sus filas.
      const rows = await probe.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenantA.id);
        return tx.$queryRawUnsafe<Array<{ tenantId: string; name: string }>>(
          'SELECT "tenantId", "name" FROM "departments"'
        );
      });
      assert.ok(rows.length > 0, "con contexto debe ver las filas de su cliente");
      assert.equal(rows.every((row) => row.tenantId === tenantA.id), true);

      // WITH CHECK: no puede insertar filas de otro cliente.
      let rejected = false;
      try {
        await probe.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenantA.id);
          await tx.$executeRawUnsafe(
            'INSERT INTO "departments" ("id", "tenantId", "name", "updatedAt") VALUES (gen_random_uuid(), $1, $2, NOW())',
            tenantB.id,
            "RLS intruso"
          );
        });
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, "RLS debe rechazar una fila de otro cliente (WITH CHECK)");
    } finally {
      await probe.$disconnect();
      await dropProbeRole();
    }
  });
});

describe("RLS y lookups pre-contexto", () => {
  test("con RLS activo: login de usuario y token de agente funcionan antes del contexto", async () => {
    // Login: el usuario se busca por username cuando todavía no hay cliente.
    const login = await api("POST", "/auth/login", {
      body: { username: client.user.username, password: DEFAULT_PASSWORD, tenant: client.tenant!.slug },
    });
    expectStatus(login, 200, "login con RLS activo");

    // Agente: se busca por hash del token antes de conocer el cliente.
    const { createAgentToken } = await import("@modules/agent/services/agent-token.service");
    const { runWithTenant } = await import("@core/tenancy");
    const { token, tokenHash } = createAgentToken();
    await runWithTenant(client.tenant!.id, () =>
      db.agent.create({
        data: { tenantId: client.tenant!.id, name: "Agente RLS", tokenHash, active: true },
      })
    );
    const config = await api("GET", "/agent/config", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expectStatus(config, 200, "token de agente con RLS activo");
  });
});

describe("lock de líder de workers", () => {
  test("dos procesos: solo uno toma el lock y el heartbeat caducado lo libera", async () => {
    const { acquireLeaderLock, heartbeatLeaderLock, releaseLeaderLock } = await import("@core/locks/leader-lock");
    const secondDb = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL as string } } });
    const name = `itest-${Date.now()}`;
    try {
      assert.equal(await acquireLeaderLock(db, name, "proc-a", 5000), true, "A toma el lock libre");
      assert.equal(await acquireLeaderLock(secondDb, name, "proc-b", 5000), false, "B no puede tomarlo");
      assert.equal(await heartbeatLeaderLock(db, name, "proc-a"), true);

      // El proceso A "muere": su heartbeat queda viejo y B puede tomar el lock.
      await db.$executeRawUnsafe(
        `UPDATE "worker_locks" SET "heartbeatAt" = NOW() - INTERVAL '1 hour' WHERE "name" = $1`,
        name
      );
      assert.equal(await acquireLeaderLock(secondDb, name, "proc-b", 5000), true, "B toma el lock caducado");
      assert.equal(await acquireLeaderLock(db, name, "proc-a", 5000), false, "A ya no es líder");

      await releaseLeaderLock(secondDb, name, "proc-b");
      assert.equal(await acquireLeaderLock(db, name, "proc-a", 5000), true, "liberado el lock, A lo retoma");
      await releaseLeaderLock(db, name, "proc-a");
    } finally {
      await db.$executeRawUnsafe(`DELETE FROM "worker_locks" WHERE "name" = $1`, name).catch(() => undefined);
      await secondDb.$disconnect();
    }
  });
});

describe("producción y observabilidad", () => {
  test("request-id de correlación: se respeta el entrante y se genera uno", async () => {
    const withHeader = await api("GET", "/health", {
      headers: { "X-Request-Id": "corr-test-123" },
    });
    expectStatus(withHeader, 200, "health con request-id");
    assert.equal(withHeader.headers.get("x-request-id"), "corr-test-123");

    const generated = await api("GET", "/health");
    expectStatus(generated, 200, "health sin request-id");
    assert.match(generated.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  });

  test("GET /metrics exige credenciales y expone métricas con un ADMIN", async () => {
    const anonymous = await api("GET", "/metrics");
    expectStatus(anonymous, 401, "metrics sin token");
    const forbidden = await api("GET", "/metrics", { token: client.token });
    expectStatus(forbidden, 403, "metrics con usuario de cliente");

    const response = await api("GET", "/metrics", { token: platform.token });
    expectStatus(response, 200, "metrics con ADMIN");
    assert.match(response.text, /http_request_duration_seconds/);
    assert.match(response.text, /queue_depth/);
  });

  test("rate limit de login: corta tras el tope y devuelve 429", async () => {
    let limited = false;
    for (let attempt = 0; attempt < 10 && !limited; attempt += 1) {
      const response = await api("POST", "/auth/login", {
        body: { username: "no-existe-rate-limit", password: "mala" },
      });
      if (response.status === 429) {
        limited = true;
        assert.equal(response.body?.code, "TOO_MANY_REQUESTS");
      }
    }
    assert.equal(limited, true, "el login debe quedar limitado después del tope");
  });
});
