/**
 * Comando manual de archivado por retención (F2-04).
 *
 * Uso (desde `api/`, con la BD de pruebas o la de producción a la que apunte
 * `DATABASE_URL` — nunca contra la nube sin querer):
 *
 *   node --require ts-node/register/transpile-only \
 *        --require tsconfig-paths/register scripts/nom-archive.ts --dry-run
 *   node --require ts-node/register/transpile-only \
 *        --require tsconfig-paths/register scripts/nom-archive.ts
 *   node --require ts-node/register/transpile-only \
 *        --require tsconfig-paths/register scripts/nom-archive.ts --tenant=<uuid>
 *
 * Solo toca clientes con `retentionMonths` configurado en `nom_settings`
 * (`PUT /nom/config`). Imprime el corte y cuántas checadas/eventos se movieron
 * a las tablas `nom_archived_*`; cada corrida queda en `audit_logs`.
 */
import { prismaClient } from "@core/config/database";
import { logger } from "@core/utils/logger";
import { NomSettingsService } from "@modules/nom/services/nom-settings.service";
import { RetentionService } from "@modules/nom/services/retention.service";

const dryRun = process.argv.includes("--dry-run");
const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="));
const tenantId = tenantArg?.split("=")[1];

const main = async () => {
  const settings = new NomSettingsService(prismaClient);
  const retention = new RetentionService(prismaClient, settings);

  const targets = tenantId
    ? [{ tenantId }]
    : await settings.tenantsWithRetention();

  if (targets.length === 0) {
    logger.info("[nom-archive] no hay clientes con retención configurada (NOM_RETENTION_MONTHS / nom_settings)");
    return;
  }

  for (const target of targets) {
    const result = await retention.archiveTenant(target.tenantId, { dryRun });
    logger.info(
      `[nom-archive] ${target.tenantId} corte=${result?.cutoff ?? "n/a"} ` +
        `dryRun=${result?.dryRun ?? "n/a"} checadas=${result?.punches ?? 0} eventos=${result?.accessEvents ?? 0}`
    );
  }
};

main()
  .catch((error) => {
    logger.error(`[nom-archive] falló: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prismaClient.$disconnect());
