import type PgBoss from "pg-boss";
import { prismaClient } from "@core/config/database";
import { env } from "@core/config/env.config";
import { HttpError } from "@core/middlewares/error.middleware";
import { LeaderElection } from "@core/locks/leader-election";
import {
  QUEUES,
  runAgentJob,
  schedulePeriodicJobs,
  startQueue,
  stopQueue,
  type AgentJobPayload,
} from "@core/queue/pg-boss";
import { drainEmailQueueOnce, emailQueueDepth, startEmailWorker } from "@core/services/email-queue";
import { forEachActiveTenant } from "@core/tenancy";
import { logger } from "@core/utils/logger";
import { SysConfigService } from "@modules/config/services/sys-config.service";
import { createTimeClockModule } from "@modules/time-clock";
import { AuditService } from "@modules/audit";
import { NotificationService } from "@modules/notifications";
import { createNomModule } from "@modules/nom";
import { createSchedulesModule } from "@modules/schedules";

export interface WorkerRuntime {
  /** Si esta instancia ganó el lock de líder de trabajos periódicos. */
  readonly isLeader: boolean;
  /** Frena timers, suelta el lock, cierra pg-boss. */
  stop: () => Promise<void>;
  /** Correos pendientes (para `/metrics`). */
  emailQueueDepth: () => Promise<number>;
}

/** Errores esperables de "ya hay una corrida": no son fallos del job. */
const ignoreConcurrentRuns = (err: unknown): void => {
  if (err instanceof HttpError && (err.status === 409 || err.code === "TIME_CLOCK_NOT_CONFIGURED")) return;
  throw err;
};

/**
 * Runtime de workers (F1B-02/03): corre en `api/src/workers/index.ts` (proceso
 * aparte) o dentro del API si `RUN_WORKERS_IN_API=true` (solo local/desarrollo).
 *
 * - Un solo líder (lock en Postgres) corre los timers periódicos: sync de
 *   relojes, padrón y drenado rápido de correo.
 * - La cola pg-boss reparte los jobs periódicos y los del agente entre todas
 *   las réplicas de worker: cada job lo procesa exactamente una.
 */
export const startWorkerRuntime = async (options: { inApi?: boolean } = {}): Promise<WorkerRuntime> => {
  const sysConfig = new SysConfigService(prismaClient);
  const timeClock = createTimeClockModule({
    sysConfig: async (key) => (await sysConfig.get(key))?.value ?? null,
  });
  const audit = new AuditService(prismaClient);
  const readSysConfig = async (key: string) => (await sysConfig.get(key))?.value ?? null;
  // El cálculo diario de jornada vive en Horarios; NOM solo lo consume (misma
  // dirección que overtime → schedules).
  const schedules = createSchedulesModule({ audit: audit.createLog, sysConfig: readSysConfig });
  // Cumplimiento NOM (LFT art. 132 fr. XXXIV): barrido de límites de jornada y
  // archivado por retención. Corre en el líder, igual que la sync de relojes.
  const nom = createNomModule({
    calculator: schedules.service,
    notifications: new NotificationService(prismaClient),
    audit: audit.createLog,
    sysConfig: readSysConfig,
  });

  let stopTimers: (() => void) | null = null;
  let stopNom: (() => void) | null = null;
  let stopEmail: (() => void) | null = null;
  let queue: PgBoss | null = null;
  let stopped = false;

  const startPeriodic = (): void => {
    if (stopped || stopTimers) return;
    stopTimers = timeClock.startWorker();
    stopNom = nom.startWorker();
    stopEmail = startEmailWorker();
    logger.info("[workers] periodic work started (this instance is the leader)");
  };
  const stopPeriodic = (): void => {
    if (stopTimers) {
      stopTimers();
      stopTimers = null;
    }
    if (stopNom) {
      stopNom();
      stopNom = null;
    }
    if (stopEmail) {
      stopEmail();
      stopEmail = null;
    }
  };

  const election = new LeaderElection(prismaClient, (isLeader) => {
    if (stopped) return;
    if (isLeader) {
      startPeriodic();
      void schedulePeriodicJobs().catch((err: unknown) =>
        logger.error(`[workers] could not schedule periodic jobs: ${err instanceof Error ? err.message : String(err)}`)
      );
    } else {
      stopPeriodic();
    }
  });
  await election.start();
  if (election.isLeader) startPeriodic();

  if (!options.inApi) {
    queue = await startQueue();
    if (queue) {
      await queue.work(QUEUES.emailDrain, async () => {
        await drainEmailQueueOnce();
      });
      await queue.work(QUEUES.clockSync, async () => {
        await forEachActiveTenant(async () => {
          try {
            await timeClock.service.sync();
          } catch (err) {
            ignoreConcurrentRuns(err);
          }
        });
      });
      await queue.work(QUEUES.roster, async () => {
        await forEachActiveTenant(async () => {
          try {
            await timeClock.roster.run("AUTO");
          } catch (err) {
            ignoreConcurrentRuns(err);
          }
        });
      });
      await queue.work(QUEUES.agent, async (job: { data: unknown }) => {
        await runAgentJob(job.data as AgentJobPayload);
      });
      logger.info(`[workers] queue handlers registered (pg-boss, email poll ${env.EMAIL_QUEUE_POLL_MS} ms)`);
    }
  }

  return {
    get isLeader() {
      return election.isLeader;
    },
    stop: async (): Promise<void> => {
      stopped = true;
      await election.stop();
      stopPeriodic();
      await stopQueue();
    },
    emailQueueDepth,
  };
};
