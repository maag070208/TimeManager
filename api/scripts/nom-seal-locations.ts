/**
 * Mueve las coordenadas en claro de `remote_punches` a la columna cifrada
 * `location` (migración `20261216000000_remote_punch_location_sealed`).
 *
 *   node --require ts-node/register/transpile-only \
 *        --require tsconfig-paths/register scripts/nom-seal-locations.ts [--dry-run]
 *
 * Corre con la misma `ENCRYPTION_KEY`/`JWT_SECRET` que el API: el trigger
 * append-only solo admite este cambio bajo `app.nom_location_seal = 'on'` y
 * verifica que ninguna otra columna cambie.
 */
import { prismaClient } from "@core/config/database";
import { runWithRlsBypass } from "@core/tenancy";
import { logger } from "@core/utils/logger";
import { sealLocation } from "@modules/nom/services/punch-location";

const dryRun = process.argv.includes("--dry-run");
const BATCH = 200;

const main = async () => {
  let moved = 0;
  for (;;) {
    const rows = await runWithRlsBypass(() =>
      prismaClient.remotePunch.findMany({
        where: { location: null, latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true, gpsAccuracyMeters: true },
        take: BATCH,
      })
    );
    if (rows.length === 0) break;
    if (dryRun) {
      moved += rows.length;
      if (rows.length < BATCH) break;
      continue;
    }
    await runWithRlsBypass(() =>
      prismaClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.nom_location_seal = 'on'`);
        for (const row of rows) {
          await tx.remotePunch.update({
            where: { id: row.id },
            data: { location: sealLocation(row), latitude: null, longitude: null, gpsAccuracyMeters: null },
          });
        }
      })
    );
    moved += rows.length;
  }
  logger.info(`[nom-seal-locations] ${dryRun ? "pendientes" : "cifrados"}: ${moved} marcajes`);
};

main()
  .catch((error) => {
    logger.error("[nom-seal-locations] falló", error);
    process.exitCode = 1;
  })
  .finally(() => prismaClient.$disconnect());
