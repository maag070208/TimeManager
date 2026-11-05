import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { logger } from "@core/utils/logger";
import { runWithTenant } from "@core/tenancy";
import type { AuditLogger } from "@modules/users/services/user.service";
import type {
  ArchiveResult,
  NomConfig,
  RetentionConfigDto,
} from "../models/entity/nom.entity";
import type { NomSettingsService } from "./nom-settings.service";

/** Meses del art. 804: último año de la relación + 1 año después de la baja. */
export const LEGAL_RETENTION_MONTHS = 12;

const PUNCH_COLUMNS = `"id", "tenantId", "clockSerial", "serialNo", "employeeNumber", "name", "method", "minor", "occurredAt", "createdAt"`;
const ACCESS_EVENT_COLUMNS = `"id", "tenantId", "type", "occurredAt", "deviceTimestamp", "employeeId", "employeeNameSnapshot", "employeeNumberSnapshot", "guardId", "siteId", "latitude", "longitude", "gpsAccuracyMeters", "locationSource", "method", "credentialVersion", "scannedPayloadHash", "clientEventId", "deviceId", "deviceCode", "notes", "voidedAt", "voidedById", "voidReason", "createdAt"`;
const REMOTE_PUNCH_COLUMNS = `"id", "tenantId", "userId", "type", "workMode", "occurredAt", "clientReportedAt", "latitude", "longitude", "gpsAccuracyMeters", "note", "clientEventId", "createdAt"`;

/** `now` menos `months` meses, en UTC (corte de retención), sin desbordar el día. */
export const retentionCutoff = (now: Date, months: number): Date => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    )
  );
};

/**
 * Retención y archivado (F2-04).
 *
 * Los registros de jornada no se borran: al cumplir la retención configurada
 * por cliente se MUEVEN a las tablas `nom_archived_*` (misma fila + timestamp
 * de archivo) dentro de una transacción que habilita la purga controlada
 * (`SET LOCAL app.nom_purge = 'on'`, único caso en que el trigger append-only
 * permite el DELETE). El corte y el resultado quedan auditados.
 */
export class RetentionService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly settings: NomSettingsService,
    private readonly audit?: AuditLogger
  ) {}

  /**
   * Corte efectivo (art. 804): nunca archiva dentro del último año de la
   * relación ni antes de 1 año después de la baja.
   */
  private async effectiveCutoff(tenantId: string, now: Date): Promise<Date> {
    const months = LEGAL_RETENTION_MONTHS;
    return retentionCutoff(now, months);
  }

  /** Usuarios con baja reciente: sus registros no se archivan todavía. */
  private async recentlyTerminated(tenantId: string, now: Date) {
    const floor = retentionCutoff(now, LEGAL_RETENTION_MONTHS);
    const users = await this.db.user.findMany({
      where: { tenantId, deactivatedAt: { not: null, gt: floor } },
      select: { id: true, employeeNumber: true },
    });
    return {
      userIds: users.map((user) => user.id),
      employeeNumbers: users.map((user) => user.employeeNumber).filter((value): value is string => !!value),
    };
  }

  async config(tenantId: string): Promise<RetentionConfigDto> {
    const config = await this.settings.resolve(tenantId);
    if (config.retentionMonths == null) {
      return { retentionMonths: null, cutoff: null, pending: { punches: 0, accessEvents: 0, remotePunches: 0 } };
    }
    const now = new Date();
    const configuredCutoff = retentionCutoff(now, config.retentionMonths);
    const legalCutoff = await this.effectiveCutoff(tenantId, now);
    const cutoff = configuredCutoff < legalCutoff ? configuredCutoff : legalCutoff;
    const terminated = await this.recentlyTerminated(tenantId, now);
    const [punches, accessEvents, remotePunches] = await Promise.all([
      this.db.timeClockPunch.count({
        where: {
          tenantId,
          occurredAt: { lt: cutoff },
          ...(terminated.employeeNumbers.length
            ? { employeeNumber: { notIn: terminated.employeeNumbers } }
            : {}),
        },
      }),
      this.db.accessEvent.count({ where: { tenantId, occurredAt: { lt: cutoff } } }),
      this.db.remotePunch.count({
        where: {
          tenantId,
          occurredAt: { lt: cutoff },
          ...(terminated.userIds.length ? { userId: { notIn: terminated.userIds } } : {}),
        },
      }),
    ]);
    return {
      retentionMonths: config.retentionMonths,
      cutoff: cutoff.toISOString(),
      pending: { punches, accessEvents, remotePunches },
    };
  }

  /** Archiva (o solo cuenta, con `dryRun`) un cliente concreto. */
  async archiveTenant(
    tenantId: string,
    options: { dryRun?: boolean; now?: Date; config?: NomConfig } = {}
  ): Promise<ArchiveResult | null> {
    const config = options.config ?? (await this.settings.resolve(tenantId));
    const retentionMonths = config.retentionMonths;
    if (retentionMonths == null) return null;

    const now = options.now ?? new Date();
    const configuredCutoff = retentionCutoff(now, retentionMonths);
    const legalCutoff = await this.effectiveCutoff(tenantId, now);
    // Nunca archiva dentro de la ventana legal (año de la relación + 1 año).
    const cutoff = configuredCutoff < legalCutoff ? configuredCutoff : legalCutoff;
    const terminated = await this.recentlyTerminated(tenantId, now);
    const punchFilter =
      terminated.employeeNumbers.length > 0
        ? { employeeNumber: { notIn: terminated.employeeNumbers } }
        : {};
    const remoteFilter =
      terminated.userIds.length > 0 ? { userId: { notIn: terminated.userIds } } : {};
    const dryRun = options.dryRun ?? false;

    if (dryRun) {
      const [punches, accessEvents, remotePunches] = await Promise.all([
        this.db.timeClockPunch.count({ where: { tenantId, occurredAt: { lt: cutoff }, ...punchFilter } }),
        this.db.accessEvent.count({ where: { tenantId, occurredAt: { lt: cutoff } } }),
        this.db.remotePunch.count({ where: { tenantId, occurredAt: { lt: cutoff }, ...remoteFilter } }),
      ]);
      return {
        tenantId,
        retentionMonths,
        cutoff: cutoff.toISOString(),
        dryRun,
        punches,
        accessEvents,
        remotePunches,
      };
    }

    const result = await this.db.$transaction(async (tx) => {
      // Fija el cliente en la transacción (RLS) y habilita la única vía de
      // DELETE sobre checadas/eventos: la purga controlada de archivo.
      await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenantId);
      await tx.$executeRawUnsafe("SET LOCAL app.nom_purge = 'on'");

      const punches = await tx.$executeRawUnsafe(
        `INSERT INTO "nom_archived_time_clock_punches" (${PUNCH_COLUMNS})
         SELECT ${PUNCH_COLUMNS} FROM "time_clock_punches"
         WHERE "tenantId" = $1 AND "occurredAt" < $2
           AND ($3::text[] IS NULL OR "employeeNumber" <> ALL($3::text[]))`,
        tenantId,
        cutoff,
        terminated.employeeNumbers.length ? terminated.employeeNumbers : null
      );
      const deletedPunches = await tx.$executeRawUnsafe(
        `DELETE FROM "time_clock_punches"
         WHERE "tenantId" = $1 AND "occurredAt" < $2
           AND ($3::text[] IS NULL OR "employeeNumber" <> ALL($3::text[]))`,
        tenantId,
        cutoff,
        terminated.employeeNumbers.length ? terminated.employeeNumbers : null
      );

      const accessEvents = await tx.$executeRawUnsafe(
        `INSERT INTO "nom_archived_access_events" (${ACCESS_EVENT_COLUMNS})
         SELECT ${ACCESS_EVENT_COLUMNS} FROM "access_events"
         WHERE "tenantId" = $1 AND "occurredAt" < $2`,
        tenantId,
        cutoff
      );
      const deletedAccessEvents = await tx.$executeRawUnsafe(
        `DELETE FROM "access_events" WHERE "tenantId" = $1 AND "occurredAt" < $2`,
        tenantId,
        cutoff
      );

      const remotePunches = await tx.$executeRawUnsafe(
        `INSERT INTO "nom_archived_remote_punches" (${REMOTE_PUNCH_COLUMNS})
         SELECT ${REMOTE_PUNCH_COLUMNS} FROM "remote_punches"
         WHERE "tenantId" = $1 AND "occurredAt" < $2
           AND ($3::text[] IS NULL OR "userId" <> ALL($3::text[]))`,
        tenantId,
        cutoff,
        terminated.userIds.length ? terminated.userIds : null
      );
      const deletedRemotePunches = await tx.$executeRawUnsafe(
        `DELETE FROM "remote_punches"
         WHERE "tenantId" = $1 AND "occurredAt" < $2
           AND ($3::text[] IS NULL OR "userId" <> ALL($3::text[]))`,
        tenantId,
        cutoff,
        terminated.userIds.length ? terminated.userIds : null
      );

      if (
        punches !== deletedPunches ||
        accessEvents !== deletedAccessEvents ||
        remotePunches !== deletedRemotePunches
      ) {
        throw new Error(
          `NOM archive mismatch: punches ${punches}/${deletedPunches}, access ${accessEvents}/${deletedAccessEvents}, remote ${remotePunches}/${deletedRemotePunches}`
        );
      }
      return {
        punches: deletedPunches,
        accessEvents: deletedAccessEvents,
        remotePunches: deletedRemotePunches,
      };
    });

    await this.audit?.({
      action: "NOM_RETENTION_ARCHIVED",
      entityType: "Tenant",
      entityId: tenantId,
      previousState: { retentionMonths },
      newState: { cutoff: cutoff.toISOString(), ...result },
      metadata: { dryRun },
    });

    return {
      tenantId,
      retentionMonths,
      cutoff: cutoff.toISOString(),
      dryRun: false,
      punches: result.punches,
      accessEvents: result.accessEvents,
      remotePunches: result.remotePunches,
    };
  }

  /**
   * Corre el archivado de todos los clientes con retención configurada
   * (worker diario). Un cliente que falla no detiene a los demás.
   */
  async archiveAllTenants(): Promise<ArchiveResult[]> {
    const tenants = await this.settings.tenantsWithRetention();
    const results: ArchiveResult[] = [];
    for (const { tenantId, retentionMonths } of tenants) {
      try {
        const result = await runWithTenant(tenantId, async () => {
          const config = await this.settings.resolve(tenantId);
          return this.archiveTenant(tenantId, { config });
        });
        if (result && (result.punches > 0 || result.accessEvents > 0 || result.remotePunches > 0)) {
          logger.info(
            `[nom] retención ${retentionMonths}m: ${result.punches} checada(s), ${result.accessEvents} evento(s) y ${result.remotePunches} marcaje(s) remoto(s) archivados en ${tenantId}`
          );
          results.push(result);
        }
      } catch (error) {
        logger.error(
          `[nom] archivado del cliente ${tenantId} falló: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return results;
  }
}
