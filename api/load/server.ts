/**
 * API mínimo para la prueba de carga (F4-05).
 *
 * `src/index.ts` se salta el seed del catálogo de permisos en `NODE_ENV=test`
 * (lo siembra el arnés de integración), así que la API de carga arrancaría con
 * el catálogo vacío y todos los `requiresPermission` darían 403. Este bootstrap
 * siembra el catálogo/matriz desde los fixtures antes de escuchar y NO arranca
 * workers (correo, relojes) para no meter ruido en las mediciones.
 *
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_test_load \
 *     PORT=4020 NODE_ENV=test \
 *     node --require ts-node/register/transpile-only \
 *          --require tsconfig-paths/register load/server.ts
 */
import { createApp } from "@src/app";
import { prismaClient } from "@core/config/database";
import { seedPermissionsFromFixtures } from "@core/permissions";
import { seedPoliciesFromFixtures } from "@core/policies";
import { logger } from "@core/utils/logger";

const port = Number(process.env.PORT ?? 4020);

const main = async (): Promise<void> => {
  await seedPermissionsFromFixtures(prismaClient);
  await seedPoliciesFromFixtures(prismaClient);
  createApp().listen(port, "127.0.0.1", () => {
    logger.info(`API de carga escuchando en http://127.0.0.1:${port}/api/v1`);
  });
};

main().catch((error: unknown) => {
  logger.error(`[load-server] no arrancó: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
