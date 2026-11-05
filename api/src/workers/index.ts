/**
 * Entrypoint del proceso de workers (F1B-02): `pnpm --filter timemanager-api workers`.
 *
 * Corre TODO lo que no debe correr en el proceso HTTP: sync de relojes, padrón,
 * cálculo/reportes en cola (pg-boss) y drenado de la cola de correo. El API ya
 * no arranca workers salvo `RUN_WORKERS_IN_API=true` (local).
 *
 * Lock de líder en Postgres (`worker_locks`): con 2+ réplicas de este proceso
 * solo una corre los timers periódicos; la cola pg-boss reparte los jobs y cada
 * uno se procesa una sola vez.
 */
import { prismaClient } from "@core/config/database";
import { logger } from "@core/utils/logger";
import { startWorkerRuntime, type WorkerRuntime } from "./runtime";

const SHUTDOWN_TIMEOUT_MS = 20_000;

const main = async (): Promise<void> => {
  logger.info(`[workers] starting (pid ${process.pid})`);
  const runtime: WorkerRuntime = await startWorkerRuntime();
  logger.info(`[workers] ready (leader=${runtime.isLeader})`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[workers] ${signal}: shutting down`);
    const force = setTimeout(() => {
      logger.error("[workers] shutdown timed out; forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();
    try {
      await runtime.stop();
      await prismaClient.$disconnect();
      clearTimeout(force);
      logger.info("[workers] stopped");
      process.exit(0);
    } catch (err) {
      logger.error(`[workers] shutdown error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (err: unknown) => {
    logger.error(`[workers] unhandled rejection: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  });
};

void main().catch(async (err: unknown) => {
  logger.error(`[workers] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  await prismaClient.$disconnect().catch(() => undefined);
  process.exit(1);
});
