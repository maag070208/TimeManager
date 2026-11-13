import type { AgentJob, AgentJobType, Prisma, PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import type { AgentJobRecord, EnqueueAgentJobInput } from "../models/entity/agent.entity";

/**
 * Cola de trabajos del agente. La implementación actual es la tabla
 * `agent_jobs` (decisión A1: pg-boss aún no está listo). Cuando entre pg-boss,
 * se cambia esta implementación por una que publique/consuma en la cola; los
 * endpoints y el agente no cambian porque solo hablan con esta interfaz.
 */
export interface AgentJobQueue {
  enqueue(input: EnqueueAgentJobInput): Promise<AgentJobRecord>;
  /** Reclama hasta `limit` trabajos PENDING disponibles para el agente (atómico). */
  claim(agentId: string, limit: number): Promise<AgentJobRecord[]>;
  complete(id: string, result: unknown): Promise<AgentJobRecord>;
  /** Reintenta con backoff o marca FAILED si se agotaron los intentos. */
  fail(id: string, error: string, result?: unknown): Promise<AgentJobRecord>;
  pendingCount(): Promise<number>;
}

/** Backoff exponencial de reintentos: 5 s, 10 s, 20 s, 40 s… tope 5 min. */
export const retryDelayMs = (attempts: number): number =>
  Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 300_000);

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export const toJobRecord = (job: AgentJob): AgentJobRecord => ({
  id: job.id,
  tenantId: job.tenantId,
  agentId: job.agentId,
  clockSerial: job.clockSerial,
  type: job.type,
  payload: (job.payload ?? {}) as Record<string, unknown>,
  status: job.status,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  availableAt: job.availableAt.toISOString(),
  claimedAt: iso(job.claimedAt),
  finishedAt: iso(job.finishedAt),
  result: job.result ?? null,
  error: job.error,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

/** Adaptador Prisma/Postgres: la cola vive en `agent_jobs` (sin worker propio). */
export class TableAgentJobQueue implements AgentJobQueue {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  async enqueue(input: EnqueueAgentJobInput): Promise<AgentJobRecord> {
    const job = await this.db.agentJob.create({
      data: {
        tenantId: input.tenantId,
        type: input.type as AgentJobType,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        clockSerial: input.clockSerial ?? null,
        agentId: input.agentId ?? null,
        ...(input.maxAttempts ? { maxAttempts: input.maxAttempts } : {}),
      },
    });
    return toJobRecord(job);
  }

  async claim(agentId: string, limit: number): Promise<AgentJobRecord[]> {
    const now = new Date();
    const candidates = await this.db.agentJob.findMany({
      where: {
        status: "PENDING",
        availableAt: { lte: now },
        OR: [{ agentId: null }, { agentId }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    // Compare-and-set por trabajo: dos agentes pueden haber visto el mismo
    // PENDING. Cada intento es independiente, así que van en paralelo.
    const won = await Promise.all(
      candidates.map(async (candidate) => {
        const result = await this.db.agentJob.updateMany({
          where: { id: candidate.id, status: "PENDING", availableAt: { lte: now } },
          data: {
            status: "RUNNING",
            agentId,
            claimedAt: now,
            attempts: { increment: 1 },
          },
        });
        return result.count === 1 ? candidate.id : null;
      })
    );
    const ids = won.filter((id): id is string => id !== null);
    if (ids.length === 0) return [];
    const jobs = await this.db.agentJob.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" } });
    return jobs.map(toJobRecord);
  }

  async complete(id: string, result: unknown): Promise<AgentJobRecord> {
    const job = await this.db.agentJob.update({
      where: { id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        error: null,
        result: (result ?? null) as Prisma.InputJsonValue,
      },
    });
    return toJobRecord(job);
  }

  async fail(id: string, error: string, result?: unknown): Promise<AgentJobRecord> {
    const current = await this.db.agentJob.findUniqueOrThrow({ where: { id } });
    const retry = current.attempts < current.maxAttempts;
    const job = await this.db.agentJob.update({
      where: { id },
      data: retry
        ? {
            status: "PENDING",
            error,
            claimedAt: null,
            availableAt: new Date(Date.now() + retryDelayMs(current.attempts)),
            result: (result ?? null) as Prisma.InputJsonValue,
          }
        : {
            status: "FAILED",
            error,
            finishedAt: new Date(),
            result: (result ?? null) as Prisma.InputJsonValue,
          },
    });
    return toJobRecord(job);
  }

  async pendingCount(): Promise<number> {
    return this.db.agentJob.count({ where: { status: "PENDING" } });
  }
}
