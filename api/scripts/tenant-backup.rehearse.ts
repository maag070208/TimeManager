/**
 * Ensayo real del respaldo por cliente (F4-04). SOLO bases locales `tm_*`.
 *
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55433/tm_backup \
 *   node --require ts-node/register/transpile-only \
 *        --require tsconfig-paths/register scripts/tenant-backup.rehearse.ts \
 *        --source-url=postgresql://postgres:test@127.0.0.1:55433/tm_backup \
 *        [--target-url=postgresql://postgres:test@127.0.0.1:55433/tm_restore]
 *
 * Pasos: siembra un cliente con datos representativos → exporta → BORRA el
 * slice → comprueba que quedó vacío → restaura → compara conteos y hashes. Si
 * hay `--target-url`, repite el restore en esa BD (debe estar vacía y migrada)
 * y verifica también. Termina con código ≠ 0 si algo no coincide.
 */
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { logger } from "@core/utils/logger";
import { hashAgentToken } from "@modules/agent/services/agent-token.service";
import { isLocalDatabaseUrl } from "@core/backup/tenant-slice";
import {
  createClient,
  deleteSlice,
  existingRowsOf,
  exportSlice,
  loadSlice,
  restoreSlice,
  verifySlice,
  writeSlice,
} from "./lib/tenant-backup";

const TENANT_SLUG = "rehearsal-backup";

const argOf = (name: string): string | null => {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const assertLocal = (url: string, label: string): void => {
  if (!isLocalDatabaseUrl(url)) throw new Error(`${label} debe ser una BD local (no la nube): ${url}`);
};

const databaseName = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "(desconocida)";
  }
};

/** Siembra datos variados del cliente (tenantId explícito: cliente sin extensión de tenancy). */
const seed = async (db: PrismaClient): Promise<string> => {
  await db.role.createMany({
    data: [
      { key: "CLIENT_ADMIN", name: "Administrador del cliente" },
      { key: "HUMAN_RESOURCES", name: "Recursos Humanos" },
      { key: "CLIENT_STAFF", name: "Personal" },
    ],
    skipDuplicates: true,
  });
  const plan = await db.plan.upsert({
    where: { key: "REHEARSAL" },
    update: {},
    create: { key: "REHEARSAL", name: "Plan de ensayo", employeeLimit: 50, clockLimit: 2 },
  });

  const tenant = await db.tenant.create({
    data: {
      name: "Cliente de ensayo (respaldo)",
      slug: `${TENANT_SLUG}-${Date.now()}`,
      planId: plan.id,
      timezone: "America/Mexico_City",
    },
  });
  const tenantId = tenant.id;

  const department = await db.department.create({
    data: { tenantId, name: "Operaciones" },
  });
  const admin = await db.user.create({
    data: {
      tenantId,
      username: `rehearsal.admin.${Date.now()}`,
      email: "rehearsal.admin@timemanager.test",
      password: "hash-solo-para-ensayo",
      name: "Admin Ensayo",
      role: "CLIENT_ADMIN",
      departmentId: department.id,
    },
  });
  const staff = await db.user.create({
    data: {
      tenantId,
      username: `rehearsal.staff.${Date.now()}`,
      password: "hash-solo-para-ensayo",
      name: "Persona Ensayo",
      role: "CLIENT_STAFF",
      employeeNumber: "900001",
      departmentId: department.id,
      photoKey: `tenants/${tenantId}/photos/900001.png`,
    },
  });

  await db.notification.create({
    data: { tenantId, userId: admin.id, type: "REHEARSAL", title: "Aviso de ensayo", detail: "Datos para el respaldo" },
  });
  await db.auditLog.create({
    data: {
      tenantId,
      action: "REHEARSAL_SEED",
      entityType: "Tenant",
      entityId: tenantId,
      userName: "rehearsal",
      metadata: { seed: true },
    },
  });

  const documentType = await db.documentType.create({
    data: { tenantId, name: "Identificación oficial", required: true },
  });
  await db.employeeDocument.create({
    data: {
      tenantId,
      userId: staff.id,
      documentTypeId: documentType.id,
      storageKey: `tenants/${tenantId}/documents/ine.pdf`,
      originalName: "ine.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      uploadedById: admin.id,
    },
  });

  const clockSerial = `REHEARSAL-${Date.now()}`;
  await db.timeClock.create({
    data: {
      serialNumber: clockSerial,
      tenantId,
      name: "Reloj de ensayo",
      url: "http://127.0.0.1:4801",
      username: "admin",
      passwordEncrypted: "v1:ensayo",
      writeEnabled: true,
      lastSerialNo: 3,
      syncedAt: new Date(),
    },
  });
  for (let serialNo = 1; serialNo <= 3; serialNo += 1) {
    await db.timeClockPunch.create({
      data: {
        tenantId,
        clockSerial,
        serialNo,
        employeeNumber: "900001",
        name: "Persona Ensayo",
        method: "FACE",
        minor: 75,
        occurredAt: new Date(`2026-11-0${serialNo}T15:00:00-07:00`),
      },
    });
  }
  await db.timeClockEmployee.create({
    data: { tenantId, employeeNumber: "900001", userId: staff.id, linkedById: admin.id },
  });
  await db.timeClockSyncEvent.create({
    data: {
      tenantId,
      clockSerial,
      trigger: "AGENT",
      ok: true,
      startedAt: new Date("2026-11-05T15:00:00Z"),
      finishedAt: new Date("2026-11-05T15:00:01Z"),
      readCount: 3,
      newCount: 3,
      lastSerialNo: 3,
    },
  });

  const agent = await db.agent.create({
    data: { tenantId, name: "PC ensayo", tokenHash: hashAgentToken(`rehearsal-${Date.now()}`), version: "0.1.0" },
  });
  await db.agentJob.create({
    data: {
      tenantId,
      agentId: agent.id,
      clockSerial,
      type: "PERSON_ADD",
      payload: { employeeNumber: "900001", name: "Persona Ensayo" },
      status: "PENDING",
    },
  });

  await db.nomSettings.create({
    data: { tenantId, workdayLimitMinutes: 720, retentionMonths: 24, updatedById: admin.id },
  });

  return tenantId;
};

const printCounts = (label: string, counts: Array<{ table: string; count: number }>): void => {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  logger.info(`[rehearsal] ${label}: ${total} fila(s) en ${counts.length} tabla(s)`);
};

const main = async (): Promise<void> => {
  const sourceUrl = argOf("source-url");
  const targetUrl = argOf("target-url");
  if (!sourceUrl) throw new Error("Falta --source-url=<BD local tm_*>");
  assertLocal(sourceUrl, "--source-url");
  if (targetUrl) assertLocal(targetUrl, "--target-url");
  if (!databaseName(sourceUrl).startsWith("tm_")) {
    throw new Error(`El ensayo solo corre sobre BD tm_* (source=${databaseName(sourceUrl)})`);
  }

  const out = argOf("out") ?? path.join(os.tmpdir(), `tenant-backup-rehearsal-${Date.now()}`);
  const source = createClient(sourceUrl);
  const started = Date.now();
  let tenantId: string | null = null;

  try {
    tenantId = await seed(source);
    logger.info(`[rehearsal] cliente sembrado ${tenantId} en ${databaseName(sourceUrl)}`);

    const slice = await exportSlice(source, tenantId);
    writeSlice(out, slice);
    printCounts(
      "exportado",
      slice.manifest.tables.map((table) => ({ table: table.table, count: table.count }))
    );
    logger.info(`[rehearsal] respaldo escrito en ${out}`);

    await deleteSlice(source, tenantId, { bypassTriggers: true });
    const leftovers = await existingRowsOf(
      source,
      tenantId,
      slice.manifest.tables.map((table) => table.table)
    );
    if (leftovers.length > 0) {
      throw new Error(`El borrado dejó filas: ${leftovers.map((t) => `${t.table}=${t.count}`).join(", ")}`);
    }
    logger.info("[rehearsal] borrado verificado: 0 filas del cliente");

    const restored = loadSlice(out);
    await restoreSlice(source, restored);
    const verification = await verifySlice(source, slice.manifest);
    if (!verification.ok) throw new Error(`Verificación tras restore: ${verification.problems.join(" | ")}`);
    printCounts(
      "restaurado y verificado en la BD origen",
      verification.tables.map((table) => ({ table: table.table, count: table.count }))
    );

    if (targetUrl) {
      const target = createClient(targetUrl);
      try {
        const existing = await existingRowsOf(
          target,
          tenantId,
          slice.manifest.tables.map((table) => table.table)
        );
        if (existing.length > 0) {
          throw new Error(`La BD destino no está limpia: ${existing.map((t) => t.table).join(", ")}`);
        }
        await restoreSlice(target, loadSlice(out));
        const targetVerification = await verifySlice(target, slice.manifest);
        if (!targetVerification.ok) {
          throw new Error(`Verificación en la BD destino: ${targetVerification.problems.join(" | ")}`);
        }
        printCounts(
          `restaurado y verificado en ${databaseName(targetUrl)} (BD limpia)`,
          targetVerification.tables.map((table) => ({ table: table.table, count: table.count }))
        );
      } finally {
        await target.$disconnect();
      }
    }

    logger.info(`[rehearsal] ENSAYO OK en ${((Date.now() - started) / 1000).toFixed(1)} s · respaldo en ${out}`);
  } finally {
    await source.$disconnect();
  }
};

main().catch((error: unknown) => {
  logger.error(`[rehearsal] FALLÓ: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
