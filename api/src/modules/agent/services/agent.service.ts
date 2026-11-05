import type { Prisma, PrismaClient, PunchMethod } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { credentialsOf } from "@modules/time-clock/services/clock-credentials";
import { currentTenantId } from "@core/tenancy";
import { createAgentToken } from "./agent-token.service";
import { TableAgentJobQueue, toJobRecord, type AgentJobQueue } from "./agent-job-queue";
import type {
  AgentAdminView,
  AgentConfig,
  AgentHeartbeatInput,
  AgentJobRecord,
  AgentPunchesInput,
  AgentPunchesResult,
  AgentRegisterInput,
  AgentSession,
  EnqueuePanelJobInput,
  SubmitAgentJobResultInput,
} from "../models/entity/agent.entity";
import type { AuditLogInput } from "@modules/audit/models/entity/audit.entity";

export type AuditLogger = (input: AuditLogInput) => Promise<unknown>;

/**
 * Cadencia que el API recomienda al agente: chunks cada 20 s (decisión del
 * 2026-11-05: 15–30 s configurables), poll de trabajos cada 5 s y heartbeat
 * cada 30 s. El agente puede ajustar el chunk desde su propia UI.
 */
export const AGENT_SYNC_DEFAULTS = {
  chunkSeconds: 20,
  jobsPollSeconds: 5,
  heartbeatSeconds: 30,
} as const;

/** `minor` ISAPI (major 5) → cómo se identificó el empleado (misma tabla que la sync del API). */
const METHOD_BY_MINOR: Record<number, PunchMethod> = {
  1: "CARD",
  38: "FINGERPRINT",
  75: "FACE",
};

/** Trabajos por poll por defecto y tope duro (el agente los ejecuta en serie). */
const DEFAULT_JOBS_PER_POLL = 5;
const MAX_JOBS_PER_POLL = 10;

const nowIso = (): string => new Date().toISOString();

export class AgentService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly jobs: AgentJobQueue = new TableAgentJobQueue(prismaClient),
    private readonly audit?: AuditLogger
  ) {}

  private log(input: AuditLogInput): void {
    void this.audit?.(input).catch(() => undefined);
  }

  /**
   * Primera conexión (y cada arranque del agente): valida la credencial, guarda
   * la versión reportada y le entrega la configuración de relojes.
   */
  async register(agent: AgentSession, input: AgentRegisterInput) {
    await this.db.agent.update({
      where: { id: agent.id },
      data: { version: input.version ?? undefined, lastSeenAt: new Date() },
    });
    this.log({
      action: "AGENT_REGISTER",
      entityType: "Agent",
      entityId: agent.id,
      userName: agent.name,
      metadata: { version: input.version ?? null, platform: input.platform ?? null },
    });
    const config = await this.config(agent);
    return { agent: config.agent, tenant: config.tenant, sync: config.sync };
  }

  /** Rota el token de dispositivo: el anterior deja de servir de inmediato. */
  async rotateToken(agent: AgentSession): Promise<{ token: string; agentId: string; tenantId: string; rotatedAt: string }> {
    const { token, tokenHash } = createAgentToken();
    await this.db.agent.update({ where: { id: agent.id }, data: { tokenHash } });
    this.log({
      action: "AGENT_TOKEN_ROTATE",
      entityType: "Agent",
      entityId: agent.id,
      userName: agent.name,
      metadata: { agentId: agent.id },
    });
    return { token, agentId: agent.id, tenantId: agent.tenantId, rotatedAt: nowIso() };
  }

  /** Relojes del cliente con sus credenciales descifradas: solo para el agente. */
  async config(agent: AgentSession): Promise<AgentConfig> {
    const [stored, tenant, clocks] = await Promise.all([
      this.db.agent.findUniqueOrThrow({ where: { id: agent.id } }),
      this.db.tenant.findUniqueOrThrow({ where: { id: agent.tenantId } }),
      this.db.timeClock.findMany({
        where: { url: { not: null } },
        orderBy: { serialNumber: "asc" },
      }),
    ]);

    return {
      agent: { id: stored.id, name: stored.name, version: stored.version },
      tenant: { id: tenant.id, name: tenant.name, timezone: tenant.timezone },
      sync: { ...AGENT_SYNC_DEFAULTS },
      clocks: clocks.map((clock) => {
        const credentials = credentialsOf(clock);
        return {
          serialNumber: clock.serialNumber,
          name: clock.name,
          url: clock.url ?? "",
          countsAttendance: clock.countsAttendance,
          writeEnabled: clock.writeEnabled,
          lastSerialNo: clock.lastSerialNo,
          syncedAt: clock.syncedAt ? clock.syncedAt.toISOString() : null,
          credentials: credentials
            ? { username: credentials.user, password: credentials.pass }
            : null,
        };
      }),
    };
  }

  /**
   * Ingesta idempotente de un chunk de checadas (F1B-13/15). El `@@unique`
   * `(clockSerial, serialNo)` hace que reintentos y chunks repetidos no
   * dupliquen: las filas ya guardadas se cuentan como `duplicates`.
   */
  async ingestPunches(agent: AgentSession, input: AgentPunchesInput): Promise<AgentPunchesResult> {
    const clock = await this.db.timeClock.findUnique({ where: { serialNumber: input.clockSerial } });
    if (!clock || !clock.url) throw new HttpError(404, "AGENT_CLOCK_NOT_FOUND");

    const startedAt = new Date();
    const rows: Prisma.TimeClockPunchCreateManyInput[] = [];
    for (const punch of input.punches) {
      const occurredAt = new Date(punch.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) continue;
      rows.push({
        clockSerial: clock.serialNumber,
        serialNo: punch.serialNo,
        employeeNumber: punch.employeeNumber.trim(),
        name: (punch.name ?? "").trim(),
        method: METHOD_BY_MINOR[punch.minor] ?? "OTHER",
        minor: punch.minor,
        occurredAt,
      });
    }

    const result = rows.length
      ? await this.db.timeClockPunch.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };
    const stored = result.count;
    const cursor = Math.max(
      clock.lastSerialNo,
      input.lastSerialNo ?? 0,
      ...rows.map((row) => row.serialNo)
    );

    await this.db.timeClock.update({
      where: { serialNumber: clock.serialNumber },
      data: { lastSerialNo: cursor, syncedAt: new Date() },
    });
    await this.db.timeClockSyncEvent.create({
      data: {
        clockSerial: clock.serialNumber,
        trigger: "AGENT",
        ok: true,
        startedAt,
        finishedAt: new Date(),
        readCount: input.punches.length,
        newCount: stored,
        lastSerialNo: cursor,
        error: null,
      },
    });
    await this.db.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });

    return { received: input.punches.length, stored, duplicates: input.punches.length - stored, cursor };
  }

  /** Entrega trabajos PENDING: los marca RUNNING y suma un intento (atómico). */
  async claimJobs(agent: AgentSession, limit = DEFAULT_JOBS_PER_POLL): Promise<AgentJobRecord[]> {
    const safeLimit = Math.min(Math.max(1, limit), MAX_JOBS_PER_POLL);
    const jobs = await this.jobs.claim(agent.id, safeLimit);
    if (jobs.length > 0) {
      await this.db.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
    }
    return jobs;
  }

  /**
   * Resultado de un trabajo. Si falla y le quedan intentos, vuelve a PENDING
   * con backoff exponencial; si los agotó, queda FAILED.
   */
  async submitJobResult(
    agent: AgentSession,
    jobId: string,
    input: SubmitAgentJobResultInput
  ): Promise<AgentJobRecord> {
    const job = await this.db.agentJob.findFirst({ where: { id: jobId } });
    if (!job) throw new HttpError(404, "AGENT_JOB_NOT_FOUND");
    if (job.agentId !== agent.id || job.status !== "RUNNING") {
      throw new HttpError(409, "AGENT_JOB_NOT_CLAIMED");
    }

    const updated = input.ok
      ? await this.jobs.complete(job.id, input.result ?? null)
      : await this.jobs.fail(job.id, input.error ?? "AGENT_JOB_FAILED", input.result);
    this.log({
      action: updated.status === "DONE" ? "AGENT_JOB_DONE" : updated.status === "FAILED" ? "AGENT_JOB_FAILED" : "AGENT_JOB_RETRY",
      entityType: "AgentJob",
      entityId: job.id,
      userName: agent.name,
      metadata: { type: job.type, attempts: updated.attempts, status: updated.status },
    });
    return updated;
  }

  /** Latido del agente: deja `lastSeenAt`/`lastSyncAt` para soporte y salud. */
  async heartbeat(agent: AgentSession, input: AgentHeartbeatInput) {
    const lastSyncAt = input.lastSyncAt ? new Date(input.lastSyncAt) : undefined;
    await this.db.agent.update({
      where: { id: agent.id },
      data: {
        lastSeenAt: new Date(),
        version: input.version ?? undefined,
        ...(lastSyncAt && !Number.isNaN(lastSyncAt.getTime()) ? { lastSyncAt } : {}),
      },
    });
    const pendingJobs = await this.jobs.pendingCount();
    return { serverTime: nowIso(), nextJobsInMs: AGENT_SYNC_DEFAULTS.jobsPollSeconds * 1000, pendingJobs };
  }

  // ── Consola de plataforma (F3-12) y panel de relojes (F3-07) ──────────

  private tenantIdOrThrow(): string {
    const tenantId = currentTenantId();
    if (!tenantId) throw new HttpError(400, "TENANT_REQUIRED");
    return tenantId;
  }

  private toAdminView(agent: {
    id: string;
    name: string;
    version: string | null;
    active: boolean;
    lastSeenAt: Date | null;
    lastSyncAt: Date | null;
    createdAt: Date;
  }): AgentAdminView {
    return {
      id: agent.id,
      name: agent.name,
      version: agent.version,
      active: agent.active,
      lastSeenAt: agent.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
      lastSyncAt: agent.lastSyncAt ? agent.lastSyncAt.toISOString() : null,
      createdAt: agent.createdAt.toISOString(),
    };
  }

  /** Agentes del cliente en contexto (consola de plataforma o panel del cliente). */
  async listAgents(): Promise<AgentAdminView[]> {
    const agents = await this.db.agent.findMany({ orderBy: { createdAt: "desc" } });
    return agents.map((agent) => this.toAdminView(agent));
  }

  /** Alta de agente: devuelve el token en claro UNA sola vez. */
  async createAgent(name: string, actor?: { id?: string; username?: string }) {
    const tenantId = this.tenantIdOrThrow();
    const { token, tokenHash } = createAgentToken();
    const agent = await this.db.agent.create({
      data: { tenantId, name: name.trim(), tokenHash },
    });
    this.log({
      action: "AGENT_CREATED",
      entityType: "Agent",
      entityId: agent.id,
      userId: actor?.id,
      userName: actor?.username,
      metadata: { name: agent.name },
    });
    return { agent: this.toAdminView(agent), token };
  }

  /** Rotación desde la consola: invalida el token vigente y entrega el nuevo. */
  async rotateTokenForConsole(id: string, actor?: { id?: string; username?: string }) {
    const agent = await this.db.agent.findUnique({ where: { id } });
    if (!agent) throw new HttpError(404, "AGENT_NOT_FOUND");
    const { token, tokenHash } = createAgentToken();
    const updated = await this.db.agent.update({ where: { id }, data: { tokenHash } });
    this.log({
      action: "AGENT_TOKEN_ROTATE",
      entityType: "Agent",
      entityId: id,
      userId: actor?.id,
      userName: actor?.username,
      metadata: { agentId: id, source: "console" },
    });
    return { agent: this.toAdminView(updated), token };
  }

  /** Revocar / reactivar el acceso de un agente (soporte). */
  async setAgentActive(id: string, active: boolean, actor?: { id?: string; username?: string }) {
    const agent = await this.db.agent.findUnique({ where: { id } });
    if (!agent) throw new HttpError(404, "AGENT_NOT_FOUND");
    const updated = await this.db.agent.update({ where: { id }, data: { active } });
    this.log({
      action: active ? "AGENT_REACTIVATED" : "AGENT_REVOKED",
      entityType: "Agent",
      entityId: id,
      userId: actor?.id,
      userName: actor?.username,
      metadata: { name: agent.name },
    });
    return this.toAdminView(updated);
  }

  /**
   * Encola un trabajo para el agente local desde el panel de relojes
   * (F3-07). El reloj debe existir, no estar dado de baja y (para escrituras)
   * tener la escritura habilitada: así el panel avisa al instante en vez de
   * encolar un trabajo que el agente no podrá aplicar.
   */
  async enqueuePanelJob(
    input: EnqueuePanelJobInput,
    actor?: { id?: string; username?: string }
  ): Promise<AgentJobRecord> {
    const tenantId = this.tenantIdOrThrow();
    const clock = await this.db.timeClock.findUnique({ where: { serialNumber: input.clockSerial } });
    if (!clock || !clock.url) throw new HttpError(404, "TIME_CLOCK_NOT_FOUND");
    if (input.type !== "SYNC" && !clock.writeEnabled) throw new HttpError(403, "TIME_CLOCK_READ_ONLY");

    const job = await this.jobs.enqueue({
      tenantId,
      type: input.type,
      clockSerial: clock.serialNumber,
      payload: { ...input.payload, clockSerial: clock.serialNumber },
    });
    this.log({
      action: "AGENT_JOB_ENQUEUED",
      entityType: "AgentJob",
      entityId: job.id,
      userId: actor?.id,
      userName: actor?.username,
      metadata: {
        type: input.type,
        clockSerial: clock.serialNumber,
        payload: input.payload,
      },
    });
    return job;
  }

  /** Últimos trabajos del cliente para mostrarlos en el panel. */
  async recentJobs(limit = 20): Promise<AgentJobRecord[]> {
    const jobs = await this.db.agentJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 50),
    });
    return jobs.map((job) => toJobRecord(job));
  }
}
