/**
 * Respaldo y restore de UN cliente (F4-04).
 *
 * Exporta el slice completo del cliente — la fila de `tenants`, todas las tablas
 * con `tenantId` y los catálogos globales que referencia (p. ej. `plans`) — y lo
 * restaura en una base limpia en orden de FKs, verificando conteos y hashes.
 * Con `--s3` incluye/restaura los archivos del expediente (fotos y documentos)
 * del bucket privado.
 *
 * Uso (desde `api/`):
 *
 *   node --require ts-node/register/transpile-only \
 *        --require tsconfig-paths/register scripts/tenant-backup.ts \
 *        export --tenant=acme --out=./backups/acme-2026-11-05 [--s3]
 *
 *   node ... scripts/tenant-backup.ts \
 *        restore --in=./backups/acme-2026-11-05 \
 *        --database-url=postgresql://postgres:test@127.0.0.1:55433/tm_restore \
 *        [--replace] [--s3] [--allow-remote]
 *
 *   node ... scripts/tenant-backup.ts \
 *        verify --in=./backups/acme-2026-11-05 \
 *        --database-url=postgresql://postgres:test@127.0.0.1:55433/tm_restore
 *
 * Seguridad: `restore` solo acepta una BD local salvo `--allow-remote` explícito,
 * y por defecto aborta si la BD destino ya tiene datos de ese cliente (usa
 * `--replace` a sabiendas). El restore es destructivo: verifica la BD destino.
 *
 * Si el API corre con RLS (`RLS_ENABLED=true`), la conexión del respaldo debe
 * usar un rol con BYPASSRLS (el de workers/migraciones) o el export verá 0 filas.
 */
import type { PrismaClient } from "@prisma/client";
import { logger } from "@core/utils/logger";
import {
  assertRestoreTargetAllowed,
  compareManifests,
  parseBackupArgs,
  validateBackupArgs,
  type BackupManifest,
} from "@core/backup/tenant-slice";
import {
  createClient,
  exportSlice,
  loadSlice,
  restoreFiles,
  restoreSlice,
  verifySlice,
  writeSlice,
} from "./lib/tenant-backup";

const USAGE = `
Respaldo por cliente (F4-04)

  export  --tenant=<slug|uuid> --out=<directorio> [--s3] [--database-url=<url>]
  restore --in=<directorio> --database-url=<url> [--replace] [--s3] [--allow-remote]
  verify  --in=<directorio> --database-url=<url>

  --s3            incluye/restaura fotos y documentos del bucket privado
  --replace       borra los datos del cliente en la BD destino antes de restaurar
  --bypass-triggers  con --replace: desactiva triggers de inmutabilidad (requiere superusuario/dueño)
  --allow-remote  permite restaurar en una BD que no es local (peligroso)
  --database-url  por defecto export usa DATABASE_URL del entorno

Sin --s3 el respaldo guarda las llaves de S3 en la BD pero no los archivos:
documenta que el bucket debe respaldarse aparte.
`;

const logManifest = (manifest: BackupManifest): void => {
  logger.info(
    `[tenant-backup] cliente ${manifest.tenant.slug} (${manifest.tenant.id}) · BD ${manifest.database} · ${manifest.exportedAt}`
  );
  for (const table of manifest.tables) {
    logger.info(`[tenant-backup]   ${table.table}: ${table.count} fila(s) sha256=${table.sha256.slice(0, 12)}…`);
  }
  for (const table of manifest.prerequisites) {
    logger.info(
      `[tenant-backup]   (global) ${table.table}: ${table.count} fila(s) sha256=${table.sha256.slice(0, 12)}…`
    );
  }
  if (manifest.files.length > 0) {
    logger.info(`[tenant-backup]   archivos S3: ${manifest.files.length}`);
  }
};

const withClient = async <T>(url: string, work: (db: PrismaClient) => Promise<T>): Promise<T> => {
  const db = createClient(url);
  try {
    return await work(db);
  } finally {
    await db.$disconnect();
  }
};

const runExport = async (tenant: string, out: string, options: { s3: boolean; url: string }): Promise<void> => {
  await withClient(options.url, async (db) => {
    const slice = await exportSlice(db, tenant, { s3: options.s3 });
    writeSlice(out, slice);
    logManifest(slice.manifest);
    const total = slice.manifest.tables.reduce((sum, table) => sum + table.count, 0);
    logger.info(`[tenant-backup] export OK → ${out} (${total} fila(s) del cliente)`);
  });
};

const runRestore = async (
  input: string,
  url: string,
  options: { replace: boolean; s3: boolean; allowRemote: boolean; bypassTriggers: boolean }
): Promise<void> => {
  assertRestoreTargetAllowed(url, options.allowRemote);
  const slice = loadSlice(input);
  logManifest(slice.manifest);

  await withClient(url, async (db) => {
    const { inserted } = await restoreSlice(db, slice, {
      replace: options.replace,
      bypassTriggers: options.bypassTriggers,
    });
    for (const entry of inserted) {
      if (entry.rows > 0) logger.info(`[tenant-backup]   restauradas ${entry.rows} en ${entry.table}`);
    }
    if (options.s3) {
      const files = await restoreFiles(slice, input);
      logger.info(`[tenant-backup]   archivos S3 restaurados: ${files}`);
    }

    const verification = await verifySlice(db, slice.manifest);
    for (const table of verification.tables) {
      logger.info(
        `[tenant-backup]   verificado ${table.table}: ${table.count} fila(s) sha256=${table.sha256.slice(0, 12)}…`
      );
    }
    if (!verification.ok) {
      for (const problem of verification.problems) logger.error(`[tenant-backup] ${problem}`);
      throw new Error(`La verificación del restore falló (${verification.problems.length} problema(s))`);
    }
    logger.info("[tenant-backup] restore OK: conteos y hashes coinciden con el respaldo");
  });
};

const runVerify = async (input: string, url: string): Promise<void> => {
  const slice = loadSlice(input);
  await withClient(url, async (db) => {
    const verification = await verifySlice(db, slice.manifest);
    const missing = compareManifests(slice.manifest.tables, verification.tables);
    if (!verification.ok || missing.length > 0) {
      for (const problem of [...verification.problems, ...missing]) logger.error(`[tenant-backup] ${problem}`);
      throw new Error("La BD destino no coincide con el respaldo");
    }
    logger.info(
      `[tenant-backup] verify OK: ${verification.tables.length} tabla(s) coinciden con ${slice.manifest.tenant.slug}`
    );
  });
};

const main = async (): Promise<void> => {
  const args = parseBackupArgs(process.argv.slice(2));
  if (args.help || args.command === null) {
    console.log(USAGE);
    if (!args.help) process.exitCode = 2;
    return;
  }
  const errors = validateBackupArgs(args);
  if (errors.length > 0) {
    for (const error of errors) logger.error(`[tenant-backup] ${error}`);
    console.log(USAGE);
    process.exitCode = 2;
    return;
  }

  if (args.command === "export") {
    const url = args.databaseUrl ?? process.env.DATABASE_URL;
    if (!url) throw new Error("Falta --database-url o DATABASE_URL para exportar");
    await runExport(args.tenant!, args.out!, { s3: args.s3, url });
    return;
  }
  if (args.command === "restore") {
    await runRestore(args.input!, args.databaseUrl!, {
      replace: args.replace,
      s3: args.s3,
      allowRemote: args.allowRemote,
      bypassTriggers: args.bypassTriggers,
    });
    return;
  }
  await runVerify(args.input!, args.databaseUrl!);
};

main().catch((error: unknown) => {
  logger.error(`[tenant-backup] falló: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
