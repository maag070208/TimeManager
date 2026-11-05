import PgBoss from "pg-boss";
import { env } from "@core/config/env.config";
import { logger } from "@core/utils/logger";

/**
 * Cola de trabajos con pg-boss (F1B-03, sin Redis): usa el mismo Postgres y
 * vive en el esquema `pgboss`. El API NO la arranca; la usa el proceso
 * `api/src/workers/index.ts`. Los jobs se reclaman con lock en la BD, así que
 * dos réplicas de worker nunca procesan el mismo trabajo.
 */
export const QUEUES = {
  /** Drenado de la cola de correo (outbox). */
  emailDrain: "email.drain",
  /** Sync de checadas de todos los clientes. */
  clockSync: "time-clock.sync",
  /** Corrida del padrón de relojes. */
  roster: "roster.run",
  /** Trabajos del agente on-prem (F1B-11/13); el handler se registra por `kind`. */
  agent: "agent.job",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

let boss: PgBoss | null = null;

export const getQueue = (): PgBoss | null => boss;

/** Arranca pg-boss (crea su esquema si falta) y lo deja listo para `work`. */
export const startQueue = async (options: { connectionString?: string } = {}): Promise<PgBoss | null> => {
  if (!env.QUEUE_ENABLED) {
    logger.info("[queue] pg-boss disabled (QUEUE_ENABLED=false)");
    return null;
  }
  if (boss) return boss;
  const connectionString = options.connectionString ?? env.WORKER_DATABASE_URL ?? env.DATABASE_URL;
  boss = new PgBoss({ connectionString, schema: "pgboss" });
  boss.on("error", (err: unknown) =>
    logger.error(`[queue] pg-boss error: ${err instanceof Error ? err.message : String(err)}`)
  );
  await boss.start();
  logger.info("[queue] pg-boss started");
  return boss;
};

/** Cierra la cola; con `graceful` termina los jobs en curso. */
export const stopQueue = async (): Promise<void> => {
  const current = boss;
  boss = null;
  if (!current) return;
  await current.stop({ graceful: true, timeout: 10_000 });
  logger.info("[queue] pg-boss stopped");
};

/** Programa los jobs periódicos (idempotente: lo puede llamar cualquier líder). */
export const schedulePeriodicJobs = async (): Promise<void> => {
  const queue = boss;
  if (!queue) return;
  await queue.schedule(QUEUES.emailDrain, "* * * * *");
  await queue.schedule(QUEUES.clockSync, "*/5 * * * *");
  await queue.schedule(QUEUES.roster, "0 * * * *");
};

/** Encola un job. Devuelve `null` si la cola no está disponible. */
export const enqueueJob = async (
  name: QueueName | string,
  data: object = {},
  options?: { singletonKey?: string; retryLimit?: number; startAfter?: number }
): Promise<string | null> => {
  if (!boss) return null;
  return boss.send(name, data, (options ?? {}) as never);
};

/** Profundidad por cola, para `/metrics` y el health de workers. */
export const queueDepths = async (): Promise<Record<string, number>> => {
  const queue = boss;
  if (!queue) return {};
  const depths: Record<string, number> = {};
  for (const name of Object.values(QUEUES)) {
    try {
      depths[name] = await queue.getQueueSize(name);
    } catch {
      // La cola pudo no existir todavía: no es un error de métricas.
      depths[name] = 0;
    }
  }
  return depths;
};

// ── Jobs del agente ─────────────────────────────────────────────────────────

export type AgentJobPayload = { kind: string; tenantId?: string; [key: string]: unknown };

type AgentJobHandler = (payload: AgentJobPayload) => Promise<void>;
const agentHandlers = new Map<string, AgentJobHandler>();

/**
 * Registra el handler de un `kind` de trabajo del agente. El módulo de agente
 * (F1B-11/13) registra aquí sus kinds sin acoplarse al worker runtime.
 */
export const registerAgentJobHandler = (kind: string, handler: AgentJobHandler): void => {
  agentHandlers.set(kind, handler);
};

/** Ejecuta un job del agente; si no hay handler registrado el job falla (retry). */
export const runAgentJob = async (payload: AgentJobPayload): Promise<void> => {
  const handler = agentHandlers.get(payload.kind);
  if (!handler) throw new Error(`No handler registered for agent job kind "${payload.kind}"`);
  await handler(payload);
};

/** Encola un trabajo del agente (singleton por `kind` para no acumular). */
export const enqueueAgentJob = async (payload: AgentJobPayload): Promise<string | null> =>
  enqueueJob(QUEUES.agent, payload, { singletonKey: `${payload.kind}:${payload.tenantId ?? "global"}` });
