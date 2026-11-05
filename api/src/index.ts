import { createApp } from "./app";
import { env as config } from "@core/config/env.config";
import { logger } from "@core/utils/logger";
import { prismaClient } from "@core/config/database";
import { seedPermissionsFromFixtures } from "@core/permissions";
import { seedPlansFromFixtures } from "@core/plans";
import { seedPoliciesFromFixtures } from "@core/policies";
import { sysConfigService } from "@modules/api.router";
import {
  DEFAULT_WEEK_START_DAY,
  WEEK_START_DAY_CONFIG_KEY,
} from "@core/utils/timezone";
import { startWorkerRuntime, type WorkerRuntime } from "./workers/runtime";

const SHUTDOWN_TIMEOUT_MS = 20_000;

/**
 * Proceso HTTP (F1B-02). Los workers periódicos (sync de relojes, padrón,
 * correo, cola pg-boss) corren en `src/workers/index.ts`. Para desarrollo
 * local se pueden correr dentro del API con `RUN_WORKERS_IN_API=true`.
 */
const app = createApp();
const server = app.listen(config.PORT, "0.0.0.0", () => {
  logger.info(`API running on port ${config.PORT} (${config.NODE_ENV})`);
});

let workerRuntime: WorkerRuntime | null = null;
let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[api] ${signal}: shutting down`);
  const force = setTimeout(() => {
    logger.error("[api] shutdown timed out; forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    if (workerRuntime) await workerRuntime.stop();
    await prismaClient.$disconnect();
  } catch (err) {
    logger.error(`[api] shutdown error: ${err instanceof Error ? err.message : String(err)}`);
  }
  clearTimeout(force);
  logger.info("[api] stopped");
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

if (process.env.NODE_ENV !== "test") {
  void (async () => {
    // Catálogo y matriz de permisos: la BD manda. Se siembran insert-missing
    // desde los fixtures (sin pisar ediciones) y se cargan en cache. Si falla,
    // la API arranca con catálogo/matriz vacíos: todo queda cerrado (fail-closed).
    try {
      await seedPermissionsFromFixtures(prismaClient);
    } catch (error) {
      logger.error(
        `Could not load the permission catalog/matrix; the API starts without permissions (everything 403): ${error}`
      );
    }

    // Planes de arranque: insert-missing (la migración ya los crea; esto cubre
    // una BD montada con `db push` o un catálogo vaciado a mano).
    try {
      await seedPlansFromFixtures(prismaClient);
    } catch (error) {
      logger.error(`Could not seed the default plans; the catalog may be empty: ${error}`);
    }

    // Políticas ABAC base: insert-missing por clave y cache del motor. Si falla,
    // el motor arranca sin reglas (las acciones quedan solo con el filtro RBAC).
    try {
      await seedPoliciesFromFixtures(prismaClient);
    } catch (error) {
      logger.error(
        `Could not load the ABAC policies; services start without dynamic policies: ${error}`
      );
    }

    // Primer día de la semana laboral (sys_config.WEEK_START_DAY): insert-missing
    // con default miércoles, para que aparezca configurable en el panel admin.
    try {
      await sysConfigService.seedFromValue(
        WEEK_START_DAY_CONFIG_KEY,
        DEFAULT_WEEK_START_DAY,
        "First day of the work week for report ranges (SUNDAY…SATURDAY)"
      );
    } catch (error) {
      logger.error(
        `Could not seed ${WEEK_START_DAY_CONFIG_KEY}; the report ranges fall back to ${DEFAULT_WEEK_START_DAY}: ${error}`
      );
    }

    if (config.RUN_WORKERS_IN_API) {
      // Solo desarrollo/local: en producción los workers son su propio proceso.
      workerRuntime = await startWorkerRuntime({ inApi: true });
      logger.warn("[api] RUN_WORKERS_IN_API=true: periodic workers run inside the API process");
    } else {
      logger.info("[api] periodic workers disabled here; run `pnpm --filter timemanager-api workers`");
    }
  })();
}
