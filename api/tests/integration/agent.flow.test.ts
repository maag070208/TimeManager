/**
 * Agente local (F1B-13/15/16/17): credencial de dispositivo por cliente,
 * ingesta idempotente de checadas y cola de trabajos hacia el reloj.
 *
 * Corre contra la API real y una BD de prueba (`tm_test_agent`). No llama a
 * ningún reloj: los trabajos se dejan en la tabla y aquí solo se verifica el
 * ciclo claim/result; la ejecución ISAPI es del agente.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  api,
  clientSession,
  createTenant,
  expectError,
  expectStatus,
  platformSession,
  setupSuite,
  stopSuite,
  unique,
} from "./harness";

const getDb = async (): Promise<PrismaClient> =>
  (await import("@core/config/database")).prismaClient;

const withTenant = async <T>(
  tenantId: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> => {
  const { runWithTenant } = await import("@core/tenancy/context");
  const client = await getDb();
  return runWithTenant(tenantId, () => fn(client));
};

interface AgentFixture {
  agent: { id: string; tenantId: string; name: string };
  token: string;
}

const createAgentFixture = async (
  tenantId: string,
  options: { active?: boolean; name?: string } = {}
): Promise<AgentFixture> => {
  const { createAgentToken } = await import("@modules/agent/services/agent-token.service");
  const { token, tokenHash } = createAgentToken();
  const agent = await withTenant(tenantId, (db) =>
    db.agent.create({
      data: {
        tenantId,
        name: options.name ?? "PC recepción",
        tokenHash,
        active: options.active ?? true,
      },
      select: { id: true, tenantId: true, name: true },
    })
  );
  return { agent, token };
};

const createClockFixture = async (
  tenantId: string,
  options: {
    serial?: string;
    url?: string | null;
    ownCredentials?: boolean;
    writeEnabled?: boolean;
  } = {}
) => {
  const { encryptSecret } = await import("@core/utils/crypto");
  const serial = options.serial ?? unique("CLK");
  return withTenant(tenantId, (db) =>
    db.timeClock.create({
      data: {
        serialNumber: serial,
        tenantId,
        name: "Entrada personal",
        url: options.url === undefined ? "https://192.168.1.50" : options.url,
        username: options.ownCredentials ? "reloj-admin" : null,
        passwordEncrypted: options.ownCredentials ? encryptSecret("s3creto-reloj") : null,
        countsAttendance: true,
        writeEnabled: options.writeEnabled ?? true,
      },
    })
  );
};

const createJobFixture = async (
  tenantId: string,
  options: {
    type?: "SYNC" | "PERSON_ADD" | "PERSON_REMOVE" | "CARD_ADD" | "FINGERPRINT_APPLY";
    maxAttempts?: number;
    agentId?: string | null;
    clockSerial?: string | null;
    payload?: Record<string, unknown>;
  } = {}
) =>
  withTenant(tenantId, (db) =>
    db.agentJob.create({
      data: {
        tenantId,
        type: options.type ?? "SYNC",
        payload: options.payload ?? { clockSerial: "CLK" },
        agentId: options.agentId ?? null,
        clockSerial: options.clockSerial ?? null,
        ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
      },
    })
  );

const punch = (serialNo: number, employeeNumber = "070562") => ({
  serialNo,
  employeeNumber,
  name: `Empleado ${employeeNumber}`,
  minor: 75,
  occurredAt: "2026-11-05T15:00:00-07:00",
});

before(async () => {
  await setupSuite();
});

after(async () => {
  await stopSuite();
});

describe("credencial del agente", () => {
  test("sin token responde 401 TOKEN_MISSING", async () => {
    const response = await api("GET", "/agent/config");
    expectError(response, 401, "TOKEN_MISSING", "config sin token de agente");
  });

  test("token desconocido y agente inactivo responden 401 INVALID_AGENT_TOKEN", async () => {
    const tenant = await createTenant();
    const revoked = await createAgentFixture(tenant.id, { active: false });

    const unknown = await api("POST", "/agent/heartbeat", {
      token: "tma_token-inventado",
      body: {},
    });
    expectError(unknown, 401, "INVALID_AGENT_TOKEN", "token inventado");

    const inactive = await api("POST", "/agent/heartbeat", {
      token: revoked.token,
      body: {},
    });
    expectError(inactive, 401, "INVALID_AGENT_TOKEN", "agente revocado");
  });

  test("rotar el token invalida el anterior de inmediato", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);

    const rotated = await api("POST", "/agent/token", { token });
    expectStatus(rotated, 200, "rotación de token del agente");
    assert.equal(typeof rotated.body?.token, "string");
    assert.equal(rotated.body?.tenantId, tenant.id);

    const old = await api("POST", "/agent/heartbeat", { token, body: {} });
    expectError(old, 401, "INVALID_AGENT_TOKEN", "token anterior tras rotar");

    const fresh = await api("POST", "/agent/heartbeat", {
      token: rotated.body!.token as string,
      body: {},
    });
    expectStatus(fresh, 200, "token nuevo tras rotar");
  });

  test("cliente suspendido responde 403 TENANT_SUSPENDED", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const client = await getDb();
    await client.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });

    const response = await api("POST", "/agent/heartbeat", { token, body: {} });
    expectError(response, 403, "TENANT_SUSPENDED", "agente de cliente suspendido");
  });
});

describe("registro y configuración", () => {
  test("register guarda versión y lastSeenAt; config trae la cadencia de sync", async () => {
    const tenant = await createTenant();
    const { agent, token } = await createAgentFixture(tenant.id);

    const registered = await api("POST", "/agent/register", {
      token,
      body: { version: "0.1.0", platform: "win32", name: "PC recepción" },
    });
    expectStatus(registered, 200, "registro del agente");
    assert.equal(registered.body?.agent?.version, "0.1.0");
    assert.equal(registered.body?.sync?.chunkSeconds, 20);

    const client = await getDb();
    const stored = await client.agent.findUniqueOrThrow({ where: { id: agent.id } });
    assert.equal(stored.version, "0.1.0");
    assert.ok(stored.lastSeenAt instanceof Date, "lastSeenAt debe quedar marcado");
  });

  test("config entrega relojes con credenciales descifradas (solo el agente)", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const clock = await createClockFixture(tenant.id, { ownCredentials: true });
    await createClockFixture(tenant.id, { url: null }); // dado de baja: no va al agente

    const response = await api("GET", "/agent/config", { token });
    expectStatus(response, 200, "config del agente");

    const clocks = response.body?.clocks as Array<Record<string, unknown>>;
    assert.equal(clocks.length, 1, "solo relojes activos (con URL)");
    const delivered = clocks.find((c) => c.serialNumber === clock.serialNumber);
    assert.ok(delivered, "el reloj propio debe venir en la config");
    assert.deepEqual(delivered.credentials, {
      username: "reloj-admin",
      password: "s3creto-reloj",
    });
    assert.equal(delivered.lastSerialNo, 0);
    assert.equal(delivered.writeEnabled, true);
  });

  test("el agente de un cliente no ve relojes de otro cliente", async () => {
    const mine = await createTenant();
    const other = await createTenant();
    const { token } = await createAgentFixture(mine.id);
    const foreign = await createClockFixture(other.id);

    const response = await api("GET", "/agent/config", { token });
    expectStatus(response, 200, "config del agente");
    const clocks = response.body?.clocks as Array<Record<string, unknown>>;
    assert.ok(
      !clocks.some((c) => c.serialNumber === foreign.serialNumber),
      "no debe filtrarse un reloj de otro cliente"
    );
  });
});

describe("ingesta de checadas", () => {
  test("el chunk es idempotente y avanza el cursor del reloj", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const clock = await createClockFixture(tenant.id);

    const first = await api("POST", "/agent/punches", {
      token,
      body: { clockSerial: clock.serialNumber, lastSerialNo: 150, punches: [punch(149), punch(150)] },
    });
    expectStatus(first, 200, "primer chunk de checadas");
    assert.equal(first.body?.received, 2);
    assert.equal(first.body?.stored, 2);
    assert.equal(first.body?.duplicates, 0);
    assert.equal(first.body?.cursor, 150);

    // El agente se cayó después de subir y reintenta el mismo chunk.
    const retry = await api("POST", "/agent/punches", {
      token,
      body: { clockSerial: clock.serialNumber, lastSerialNo: 150, punches: [punch(149), punch(150)] },
    });
    expectStatus(retry, 200, "reintento del mismo chunk");
    assert.equal(retry.body?.stored, 0);
    assert.equal(retry.body?.duplicates, 2);
    assert.equal(retry.body?.cursor, 150);

    const client = await getDb();
    const punches = await client.timeClockPunch.findMany({
      where: { clockSerial: clock.serialNumber },
      orderBy: { serialNo: "asc" },
    });
    assert.equal(punches.length, 2, "no se duplican las checadas");
    assert.equal(punches[0].method, "FACE", "minor 75 se guarda como FACE");
    assert.equal(punches[1].serialNo, 150);

    const storedClock = await client.timeClock.findUniqueOrThrow({
      where: { serialNumber: clock.serialNumber },
    });
    assert.equal(storedClock.lastSerialNo, 150);
    assert.ok(storedClock.syncedAt instanceof Date);

    const syncEvent = await client.timeClockSyncEvent.findFirst({
      where: { clockSerial: clock.serialNumber },
    });
    assert.ok(syncEvent, "la ingesta deja un TimeClockSyncEvent para soporte");
    assert.equal(syncEvent.trigger, "AGENT");
    assert.equal(syncEvent.newCount, 2);
  });

  test("un reloj de otro cliente responde 404 AGENT_CLOCK_NOT_FOUND", async () => {
    const mine = await createTenant();
    const other = await createTenant();
    const { token } = await createAgentFixture(mine.id);
    const foreign = await createClockFixture(other.id);

    const response = await api("POST", "/agent/punches", {
      token,
      body: { clockSerial: foreign.serialNumber, punches: [punch(1)] },
    });
    expectError(response, 404, "AGENT_CLOCK_NOT_FOUND", "checadas de reloj ajeno");
  });

  test("un reloj dado de baja responde 404 AGENT_CLOCK_NOT_FOUND", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const retired = await createClockFixture(tenant.id, { url: null });

    const response = await api("POST", "/agent/punches", {
      token,
      body: { clockSerial: retired.serialNumber, punches: [punch(1)] },
    });
    expectError(response, 404, "AGENT_CLOCK_NOT_FOUND", "checadas de reloj dado de baja");
  });

  test("valida el cuerpo del chunk (400 VALIDATION_ERROR)", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);

    const response = await api("POST", "/agent/punches", {
      token,
      body: { clockSerial: "CLK-1", punches: [] },
    });
    expectError(response, 400, "VALIDATION_ERROR", "chunk sin checadas");
  });
});

describe("cola de trabajos", () => {
  test("claim marca RUNNING con un intento; result ok lo deja DONE", async () => {
    const tenant = await createTenant();
    const { agent, token } = await createAgentFixture(tenant.id);
    const job = await createJobFixture(tenant.id, { type: "SYNC" });

    const claimed = await api("GET", "/agent/jobs", { token });
    expectStatus(claimed, 200, "claim de trabajos");
    const jobs = claimed.body?.jobs as Array<Record<string, unknown>>;
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, job.id);
    assert.equal(jobs[0].status, "RUNNING");
    assert.equal(jobs[0].attempts, 1);

    const result = await api("POST", `/agent/jobs/${job.id}/result`, {
      token,
      body: { ok: true, result: { newCount: 2, cursor: 150 } },
    });
    expectStatus(result, 200, "resultado OK del trabajo");
    assert.equal(result.body?.status, "DONE");

    const client = await getDb();
    const stored = await client.agentJob.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(stored.status, "DONE");
    assert.deepEqual(stored.result, { newCount: 2, cursor: 150 });
    assert.equal(stored.agentId, agent.id);
  });

  test("el agente solo ve trabajos de su cliente", async () => {
    const mine = await createTenant();
    const other = await createTenant();
    const { token } = await createAgentFixture(mine.id);
    const foreignJob = await createJobFixture(other.id);

    const claimed = await api("GET", "/agent/jobs", { token });
    expectStatus(claimed, 200, "claim de trabajos");
    const jobs = claimed.body?.jobs as Array<Record<string, unknown>>;
    assert.ok(!jobs.some((j) => j.id === foreignJob.id), "no debe ver trabajos de otro cliente");
  });

  test("un trabajo de otro agente no aparece en el claim", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const otherAgent = await createAgentFixture(tenant.id, { name: "PC bodega" });
    const job = await createJobFixture(tenant.id, { agentId: otherAgent.agent.id });

    const claimed = await api("GET", "/agent/jobs", { token });
    expectStatus(claimed, 200, "claim de trabajos");
    const jobs = claimed.body?.jobs as Array<Record<string, unknown>>;
    assert.ok(!jobs.some((j) => j.id === job.id), "el trabajo dirigido no se entrega a otro agente");
  });

  test("un fallo reintenta con backoff y al agotar intentos queda FAILED", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const job = await createJobFixture(tenant.id, { maxAttempts: 2 });
    const client = await getDb();

    await api("GET", "/agent/jobs", { token });
    const firstFailure = await api("POST", `/agent/jobs/${job.id}/result`, {
      token,
      body: { ok: false, error: "ISAPI timeout" },
    });
    expectStatus(firstFailure, 200, "primer fallo del trabajo");
    assert.equal(firstFailure.body?.status, "PENDING");
    const pending = await client.agentJob.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(pending.attempts, 1);
    assert.ok(pending.availableAt.getTime() > Date.now(), "backoff: no se reintenta de inmediato");

    // Se adelanta el reloj del backoff para no dormir la prueba.
    await client.agentJob.update({
      where: { id: job.id },
      data: { availableAt: new Date(Date.now() - 1000) },
    });
    const reclaimed = await api("GET", "/agent/jobs", { token });
    const jobs = reclaimed.body?.jobs as Array<Record<string, unknown>>;
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].attempts, 2);

    const lastFailure = await api("POST", `/agent/jobs/${job.id}/result`, {
      token,
      body: { ok: false, error: "ISAPI timeout" },
    });
    expectStatus(lastFailure, 200, "fallo definitivo del trabajo");
    assert.equal(lastFailure.body?.status, "FAILED");
  });

  test("resultado de un trabajo no reclamado o inexistente", async () => {
    const tenant = await createTenant();
    const { token } = await createAgentFixture(tenant.id);
    const job = await createJobFixture(tenant.id);

    const notClaimed = await api("POST", `/agent/jobs/${job.id}/result`, {
      token,
      body: { ok: true },
    });
    expectError(notClaimed, 409, "AGENT_JOB_NOT_CLAIMED", "resultado sin reclamar");

    await api("GET", "/agent/jobs", { token });
    const missing = await api("POST", "/agent/jobs/00000000-0000-0000-0000-000000000000/result", {
      token,
      body: { ok: true },
    });
    expectError(missing, 404, "AGENT_JOB_NOT_FOUND", "trabajo inexistente");
  });
});

describe("heartbeat", () => {
  test("actualiza lastSeenAt/lastSyncAt y reporta trabajos pendientes", async () => {
    const tenant = await createTenant();
    const { agent, token } = await createAgentFixture(tenant.id);
    await createJobFixture(tenant.id);

    const lastSyncAt = new Date().toISOString();
    const response = await api("POST", "/agent/heartbeat", {
      token,
      body: { version: "0.2.0", lastSyncAt, pendingPunches: 0 },
    });
    expectStatus(response, 200, "heartbeat del agente");
    assert.equal(response.body?.pendingJobs, 1);
    assert.equal(typeof response.body?.nextJobsInMs, "number");

    const client = await getDb();
    const stored = await client.agent.findUniqueOrThrow({ where: { id: agent.id } });
    assert.equal(stored.version, "0.2.0");
    assert.equal(stored.lastSyncAt?.toISOString(), lastSyncAt);
    assert.ok(stored.lastSeenAt instanceof Date);
  });
});

describe("consola del agente (plataforma, F3-12)", () => {
  test("crear agente devuelve el token una sola vez y la lista no lo expone", async () => {
    const tenant = await createTenant();
    const platform = await platformSession("ADMIN");

    const empty = await api("GET", "/agent/agents", { token: platform.token, tenantId: tenant.id });
    expectStatus(empty, 200, "lista de agentes vacía");

    const created = await api("POST", "/agent/agents", {
      token: platform.token,
      tenantId: tenant.id,
      body: { name: "PC recepción" },
    });
    expectStatus(created, 201, "alta de agente desde la consola");
    assert.match(created.body?.token as string, /^tma_/);
    assert.equal(created.body?.agent?.name, "PC recepción");
    assert.equal(created.body?.agent?.active, true);
    assert.equal(created.body?.agent?.tokenHash, undefined, "el hash nunca sale");

    const listed = await api("GET", "/agent/agents", { token: platform.token, tenantId: tenant.id });
    expectStatus(listed, 200, "lista con el agente nuevo");
    const agents = listed.body?.agents as Array<Record<string, unknown>>;
    assert.equal(agents.length, 1);
    assert.equal(agents[0].id, created.body?.agent?.id);
    assert.equal(agents[0].token, undefined, "la lista no repite el token");

    // El token emitido sirve como credencial de dispositivo.
    const heartbeat = await api("POST", "/agent/heartbeat", {
      token: created.body!.token as string,
      body: {},
    });
    expectStatus(heartbeat, 200, "token emitido por la consola sirve como credencial");
  });

  test("rotar desde la consola invalida el token vigente del agente", async () => {
    const tenant = await createTenant();
    const platform = await platformSession("ADMIN");
    const created = await api("POST", "/agent/agents", {
      token: platform.token,
      tenantId: tenant.id,
      body: { name: "PC bodega" },
    });
    expectStatus(created, 201, "alta de agente para rotar");
    const agentId = created.body!.agent.id as string;

    const rotated = await api("POST", `/agent/agents/${agentId}/token`, {
      token: platform.token,
      tenantId: tenant.id,
    });
    expectStatus(rotated, 200, "rotación desde la consola");
    assert.match(rotated.body?.token as string, /^tma_/);

    const oldToken = await api("POST", "/agent/heartbeat", {
      token: created.body!.token as string,
      body: {},
    });
    expectError(oldToken, 401, "INVALID_AGENT_TOKEN", "token anterior tras rotar en consola");

    const newToken = await api("POST", "/agent/heartbeat", {
      token: rotated.body!.token as string,
      body: {},
    });
    expectStatus(newToken, 200, "token nuevo tras rotar en consola");
  });

  test("revocar y reactivar el agente desde la consola", async () => {
    const tenant = await createTenant();
    const platform = await platformSession("ADMIN");
    const created = await api("POST", "/agent/agents", {
      token: platform.token,
      tenantId: tenant.id,
      body: { name: "PC soporte" },
    });
    const agentId = created.body!.agent.id as string;
    const agentToken = created.body!.token as string;

    const revoked = await api("PATCH", `/agent/agents/${agentId}`, {
      token: platform.token,
      tenantId: tenant.id,
      body: { active: false },
    });
    expectStatus(revoked, 200, "revocar agente");
    assert.equal(revoked.body?.active, false);

    const blocked = await api("POST", "/agent/heartbeat", { token: agentToken, body: {} });
    expectError(blocked, 401, "INVALID_AGENT_TOKEN", "agente revocado");

    const reactivated = await api("PATCH", `/agent/agents/${agentId}`, {
      token: platform.token,
      tenantId: tenant.id,
      body: { active: true },
    });
    expectStatus(reactivated, 200, "reactivar agente");
    const allowed = await api("POST", "/agent/heartbeat", { token: agentToken, body: {} });
    expectStatus(allowed, 200, "agente reactivado");
  });

  test("la consola de agentes es solo para plataforma", async () => {
    const tenant = await createTenant();
    const client = await clientSession("CLIENT_ADMIN", { tenant });

    const response = await api("GET", "/agent/agents", { token: client.token });
    expectError(response, 403, "INSUFFICIENT_PERMISSIONS", "consola de agentes con usuario de cliente");
  });

  test("agente de otro cliente no aparece en la lista", async () => {
    const mine = await createTenant();
    const other = await createTenant();
    const platform = await platformSession("ADMIN");
    const created = await api("POST", "/agent/agents", {
      token: platform.token,
      tenantId: other.id,
      body: { name: "PC otro cliente" },
    });
    expectStatus(created, 201, "agente del otro cliente");

    const listed = await api("GET", "/agent/agents", { token: platform.token, tenantId: mine.id });
    expectStatus(listed, 200, "lista del cliente propio");
    const agents = listed.body?.agents as Array<Record<string, unknown>>;
    assert.ok(!agents.some((agent) => agent.id === created.body?.agent?.id));
  });
});

describe("trabajos encolados desde el panel (F3-07)", () => {
  test("el panel encola PERSON_ADD/PERSON_REMOVE/CARD_ADD y el agente los reclama", async () => {
    const tenant = await createTenant();
    const session = await clientSession("CLIENT_ADMIN", { tenant });
    const clock = await createClockFixture(tenant.id, { writeEnabled: true });
    const agent = await createAgentFixture(tenant.id);

    const enqueue = async (body: Record<string, unknown>) =>
      api("POST", "/agent/jobs", { token: session.token, body: { clockSerial: clock.serialNumber, ...body } });

    const add = await enqueue({
      type: "PERSON_ADD",
      payload: { employeeNumber: "070562", name: "Ana Pérez", gender: "female" },
    });
    expectStatus(add, 201, "encolar alta de persona");
    assert.equal(add.body?.type, "PERSON_ADD");
    assert.equal(add.body?.status, "PENDING");
    assert.equal(add.body?.clockSerial, clock.serialNumber);

    const remove = await enqueue({
      type: "PERSON_REMOVE",
      payload: { employeeNumber: "070562" },
    });
    expectStatus(remove, 201, "encolar baja de persona");

    const card = await enqueue({
      type: "CARD_ADD",
      payload: { employeeNumber: "070562", cardNo: "0012345678" },
    });
    expectStatus(card, 201, "encolar alta de tarjeta");

    const sync = await enqueue({ type: "SYNC" });
    expectStatus(sync, 201, "encolar sincronización");

    const recent = await api("GET", "/agent/jobs/recent", { token: session.token });
    expectStatus(recent, 200, "trabajos recientes del panel");
    const jobs = recent.body?.jobs as Array<Record<string, unknown>>;
    assert.ok(jobs.some((job) => job.id === add.body?.id && job.status === "PENDING"));

    // El agente los reclama y ejecuta el alta (aquí solo reporta OK).
    const claimed = await api("GET", "/agent/jobs?limit=10", { token: agent.token });
    expectStatus(claimed, 200, "el agente reclama los trabajos del panel");
    const claimedJobs = claimed.body?.jobs as Array<Record<string, unknown>>;
    assert.equal(claimedJobs.length, 4);
    const job = claimedJobs.find((candidate) => candidate.type === "PERSON_ADD");
    assert.ok(job, "el alta de persona viaja al agente");
    assert.deepEqual(job.payload, {
      employeeNumber: "070562",
      name: "Ana Pérez",
      gender: "female",
      clockSerial: clock.serialNumber,
    });

    const result = await api("POST", `/agent/jobs/${job.id}/result`, {
      token: agent.token,
      body: { ok: true, result: { employeeNumber: "070562" } },
    });
    expectStatus(result, 200, "resultado del trabajo del panel");
    assert.equal(result.body?.status, "DONE");
  });

  test("encolar escrituras en un reloj de solo lectura responde 403", async () => {
    const tenant = await createTenant();
    const session = await clientSession("CLIENT_ADMIN", { tenant });
    const clock = await createClockFixture(tenant.id, { writeEnabled: false });

    const response = await api("POST", "/agent/jobs", {
      token: session.token,
      body: {
        type: "PERSON_ADD",
        clockSerial: clock.serialNumber,
        payload: { employeeNumber: "1", name: "Ana" },
      },
    });
    expectError(response, 403, "TIME_CLOCK_READ_ONLY", "escritura encolada en reloj de solo lectura");

    const sync = await api("POST", "/agent/jobs", {
      token: session.token,
      body: { type: "SYNC", clockSerial: clock.serialNumber },
    });
    expectStatus(sync, 201, "SYNC sí se permite en un reloj de solo lectura");
  });

  test("permisos: CLIENT_STAFF no puede encolar y un reloj ajeno responde 404", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    const staff = await clientSession("CLIENT_STAFF", { tenant });
    const admin = await clientSession("CLIENT_ADMIN", { tenant });
    const clock = await createClockFixture(tenant.id);
    const foreign = await createClockFixture(other.id);

    const denied = await api("POST", "/agent/jobs", {
      token: staff.token,
      body: { type: "SYNC", clockSerial: clock.serialNumber },
    });
    expectError(denied, 403, "INSUFFICIENT_PERMISSIONS", "CLIENT_STAFF encolando");

    const foreignClock = await api("POST", "/agent/jobs", {
      token: admin.token,
      body: { type: "SYNC", clockSerial: foreign.serialNumber },
    });
    expectError(foreignClock, 404, "TIME_CLOCK_NOT_FOUND", "reloj de otro cliente");

    const invalid = await api("POST", "/agent/jobs", {
      token: admin.token,
      body: { type: "PERSON_ADD", clockSerial: clock.serialNumber, payload: { name: "sin número" } },
    });
    expectError(invalid, 400, "VALIDATION_ERROR", "payload incompleto");
  });
});
