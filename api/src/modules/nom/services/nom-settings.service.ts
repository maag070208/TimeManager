import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { localDateKey } from "@core/utils/timezone";
import type { AuditLogger } from "@modules/users/services/user.service";
import type {
  NomConfig,
  NomSettingsUpdateInput,
  TeleworkPolicyTexts,
  TeleworkPolicyUpdateInput,
} from "../models/entity/nom.entity";

/** Secciones mínimas de la política de teletrabajo (NOM-037 5.2). */
export const TELEWORK_POLICY_SECTIONS = [
  "horario",
  "desconexion",
  "riesgos",
  "equipo",
  "lactancia",
  "reversibilidad",
] as const;

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Plantilla base con las secciones obligatorias de la política (NOM-037 5.2). */
export const teleworkPolicyTemplate = (): string => `## 1. Horario y distribución de la jornada
Horario pactado, distribución semanal y pausas, sin exceder los máximos legales.

## 2. Desconexión digital
Derecho a la desconexión fuera de la jornada; el sistema difiere avisos no urgentes.

## 3. Riesgos ergonómicos y psicosociales
Riesgos identificados, medidas preventivas y canal de reporte.

## 4. Equipo de trabajo
Equipo de cómputo y ergonómico entregado, con acuse de recibo.

## 5. Lactancia
Facilidades de lactancia conforme a la LFT (dos reposos o reducción de jornada).

## 6. Reversibilidad a presencial
Procedimiento y plazos para solicitar el regreso al centro de trabajo.`;

/** Claves globales de `sys_config` que sirven de default de plataforma. */
export const NOM_WORKDAY_LIMIT_CONFIG_KEY = "NOM_WORKDAY_LIMIT_MINUTES";
export const NOM_WEEKLY_LIMIT_CONFIG_KEY = "NOM_WEEKLY_LIMIT_MINUTES";
export const NOM_RETENTION_MONTHS_CONFIG_KEY = "NOM_RETENTION_MONTHS";

/** Tope legal diario (ordinaria + extra): 12 h (art. 68 LFT). */
export const LEGAL_WORKDAY_LIMIT_MINUTES = 12 * 60;

/**
 * Jornada ordinaria máxima semanal por año (transitorio 2.º del decreto LFT
 * publicado el 01-may-2026): 48 h 2026, 46 h 2027, 44 h 2028, 42 h 2029 y
 * 40 h desde 2030.
 */
export const weeklyLimitForYear = (year: number): number => {
  if (year >= 2030) return 40 * 60;
  if (year >= 2029) return 42 * 60;
  if (year >= 2028) return 44 * 60;
  if (year >= 2027) return 46 * 60;
  return 48 * 60;
};

/**
 * Horas extra semanales pagadas al doble por año (transitorio 4.º):
 * 9 h en 2026-2027, 10 h en 2028, 11 h en 2029 y 12 h desde 2030.
 */
export const weeklyOvertimeLimitForYear = (year: number): number => {
  if (year >= 2030) return 12 * 60;
  if (year >= 2029) return 11 * 60;
  if (year >= 2028) return 10 * 60;
  return 9 * 60;
};

/** Excedente semanal pagado al triple (art. 68): hasta 4 h por semana. */
export const WEEKLY_OVERTIME_TRIPLE_LIMIT_MINUTES = 4 * 60;
/** Máximo de horas extra en un día (art. 66): 4 h. */
export const DAILY_OVERTIME_LIMIT_MINUTES = 4 * 60;
/** Máximo de días con horas extra en la semana (art. 66): 4. */
export const MAX_OVERTIME_DAYS_PER_WEEK = 4;

/**
 * Umbral semanal de infracción: jornada ordinaria + extra al doble del año +
 * excedente al triple (4 h). Por encima de esto se rompe el art. 66/68; no
 * confundir con la jornada ordinaria sola (eso marcaría toda hora extra).
 */
export const weeklyInfractionLimitForYear = (
  year: number,
  ordinaryLimitMinutes: number = weeklyLimitForYear(year)
): number =>
  ordinaryLimitMinutes +
  weeklyOvertimeLimitForYear(year) +
  WEEKLY_OVERTIME_TRIPLE_LIMIT_MINUTES;

export const MIN_WORKDAY_LIMIT_MINUTES = 60;
/** Nunca puede superar el máximo legal del art. 68 (12 h). */
export const MAX_WORKDAY_LIMIT_MINUTES = LEGAL_WORKDAY_LIMIT_MINUTES;
export const MIN_WEEKLY_LIMIT_MINUTES = 600;
/** Tope absoluto (año 2030+). El tope real se valida contra el año vigente. */
export const MAX_WEEKLY_LIMIT_MINUTES = 40 * 60;
export const MIN_RETENTION_MONTHS = 1;
export const MAX_RETENTION_MONTHS = 120;

type SysConfigReader = (key: string) => Promise<string | null>;

const parsePositiveInt = (value: string | null | undefined): number | null => {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Configuración NOM por cliente (F2-03/F2-04).
 *
 * Precedencia: `nom_settings` del cliente → `sys_config` global (default de
 * plataforma) → default legal calculado. Los límites son minutos; el semanal
 * sin configurar se calcula por año (48/46/44/42/40 h de 2026 a 2030+). El
 * cliente solo puede configurar topes más estrictos que la ley.
 */
export class NomSettingsService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly sysConfig?: SysConfigReader,
    private readonly audit?: AuditLogger
  ) {}

  private async sysInt(key: string): Promise<number | null> {
    if (!this.sysConfig) return null;
    try {
      return parsePositiveInt(await this.sysConfig(key));
    } catch {
      return null;
    }
  }

  async resolve(tenantId: string): Promise<NomConfig> {
    const [settings, tenant] = await Promise.all([
      this.db.nomSettings.findUnique({ where: { tenantId } }),
      this.db.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true, weekStartDay: true } }),
    ]);
    const timezone = tenant?.timezone ?? "America/Mexico_City";
    const year = Number(localDateKey(new Date(), timezone).slice(0, 4));

    const sysWorkday = await this.sysInt(NOM_WORKDAY_LIMIT_CONFIG_KEY);
    const sysWeekly = await this.sysInt(NOM_WEEKLY_LIMIT_CONFIG_KEY);
    const sysRetention = await this.sysInt(NOM_RETENTION_MONTHS_CONFIG_KEY);
    const legalWeekly = weeklyLimitForYear(year);

    // Solo más estricto que la ley: recorta valores legados o de sys_config.
    const workdayLimitMinutes = Math.min(
      settings?.workdayLimitMinutes ?? sysWorkday ?? LEGAL_WORKDAY_LIMIT_MINUTES,
      LEGAL_WORKDAY_LIMIT_MINUTES
    );
    const weeklyLimitMinutes = Math.min(
      settings?.weeklyLimitMinutes ?? sysWeekly ?? legalWeekly,
      legalWeekly
    );
    const retentionMonths = settings?.retentionMonths ?? sysRetention ?? null;

    const policy: TeleworkPolicyTexts = {
      teleworkPolicy: settings?.teleworkPolicy ?? null,
      disconnectPolicy: settings?.disconnectPolicy ?? null,
      privacyNotice: settings?.privacyNotice ?? null,
      policyVersion: settings?.policyVersion ?? 1,
      privacyNoticeVersion: settings?.privacyNoticeVersion ?? 1,
      policiesUpdatedAt: settings?.policiesUpdatedAt?.toISOString() ?? null,
    };

    return {
      workdayLimitMinutes,
      weekStartDay: tenant?.weekStartDay ?? 3,
      attendanceDefaults: {
        entryToleranceMin: settings?.defaultEntryToleranceMin ?? 10,
        exitToleranceMin: settings?.defaultExitToleranceMin ?? 10,
        mealBreakMin: settings?.defaultMealBreakMin ?? 0,
        minOvertimeMin: settings?.defaultMinOvertimeMin ?? 60,
      },
      weeklyLimitMinutes,
      retentionMonths,
      remotePunchEnabled: settings?.remotePunchEnabled ?? true,
      remoteCountsForWorkday: settings?.remoteCountsForWorkday ?? true,
      blockRemoteWithoutAgreement: settings?.blockRemoteWithoutAgreement ?? true,
      requireUnionForCollective: settings?.requireUnionForCollective ?? true,
      remoteGeolocationEnabled: settings?.remoteGeolocationEnabled ?? true,
      lunchPunchEnabled: settings?.lunchPunchEnabled ?? true,
      policy,
      source: {
        workdayLimit: settings?.workdayLimitMinutes != null ? "tenant" : sysWorkday != null ? "sys_config" : "legal_default",
        weeklyLimit: settings?.weeklyLimitMinutes != null ? "tenant" : sysWeekly != null ? "sys_config" : "legal_default",
        retention:
          settings?.retentionMonths != null ? "tenant" : sysRetention != null ? "sys_config" : "disabled",
      },
      legal: {
        year,
        weeklyLimitMinutes: legalWeekly,
        workdayLimitMinutes: LEGAL_WORKDAY_LIMIT_MINUTES,
        weeklyOvertimeLimitMinutes: weeklyOvertimeLimitForYear(year),
        weeklyTripleLimitMinutes: WEEKLY_OVERTIME_TRIPLE_LIMIT_MINUTES,
        dailyOvertimeLimitMinutes: DAILY_OVERTIME_LIMIT_MINUTES,
        maxOvertimeDaysPerWeek: MAX_OVERTIME_DAYS_PER_WEEK,
        weeklyInfractionLimitMinutes: weeklyInfractionLimitForYear(year),
      },
    };
  }

  /** Guarda la configuración del cliente y la audita (valor anterior/nuevo). */
  async update(
    tenantId: string,
    actor: { id: string; name?: string | null },
    input: NomSettingsUpdateInput
  ): Promise<NomConfig> {
    const previous = await this.resolve(tenantId);


    if (input.weekStartDay != null) {
      if (!Number.isInteger(input.weekStartDay) || input.weekStartDay < 0 || input.weekStartDay > 6) {
        throw new HttpError(400, "INVALID_WEEK_START_DAY");
      }
    }

    if (
      input.workdayLimitMinutes != null &&
      (input.workdayLimitMinutes < MIN_WORKDAY_LIMIT_MINUTES ||
        input.workdayLimitMinutes > MAX_WORKDAY_LIMIT_MINUTES)
    ) {
      throw new HttpError(400, "INVALID_WORKDAY_LIMIT", {
        min: MIN_WORKDAY_LIMIT_MINUTES,
        max: MAX_WORKDAY_LIMIT_MINUTES,
      });
    }
    if (
      input.weeklyLimitMinutes != null &&
      (input.weeklyLimitMinutes < MIN_WEEKLY_LIMIT_MINUTES ||
        input.weeklyLimitMinutes > previous.legal.weeklyLimitMinutes)
    ) {
      throw new HttpError(400, "INVALID_WEEKLY_LIMIT", {
        min: MIN_WEEKLY_LIMIT_MINUTES,
        max: previous.legal.weeklyLimitMinutes,
        legal: previous.legal.weeklyLimitMinutes,
        year: previous.legal.year,
      });
    }
    if (
      input.retentionMonths != null &&
      (input.retentionMonths < MIN_RETENTION_MONTHS ||
        input.retentionMonths > MAX_RETENTION_MONTHS)
    ) {
      throw new HttpError(400, "INVALID_RETENTION_MONTHS", {
        min: MIN_RETENTION_MONTHS,
        max: MAX_RETENTION_MONTHS,
      });
    }

    // Se guarda hasta que toda la petición pasó la validación.
    if (input.weekStartDay != null) {
      await this.db.tenant.update({ where: { id: tenantId }, data: { weekStartDay: input.weekStartDay } });
    }
    // Lo mismo en el alta que en la edición: en un cliente sin configuración
    // el primer guardado también aplica todos los campos que llegan.
    const changes = {
      ...(input.workdayLimitMinutes !== undefined ? { workdayLimitMinutes: input.workdayLimitMinutes } : {}),
      ...(input.weeklyLimitMinutes !== undefined ? { weeklyLimitMinutes: input.weeklyLimitMinutes } : {}),
      ...(input.retentionMonths !== undefined ? { retentionMonths: input.retentionMonths } : {}),
      ...(input.defaultEntryToleranceMin !== undefined ? { defaultEntryToleranceMin: input.defaultEntryToleranceMin } : {}),
      ...(input.defaultExitToleranceMin !== undefined ? { defaultExitToleranceMin: input.defaultExitToleranceMin } : {}),
      ...(input.defaultMealBreakMin !== undefined ? { defaultMealBreakMin: input.defaultMealBreakMin } : {}),
      ...(input.defaultMinOvertimeMin !== undefined ? { defaultMinOvertimeMin: input.defaultMinOvertimeMin } : {}),
      ...(input.remotePunchEnabled !== undefined ? { remotePunchEnabled: input.remotePunchEnabled } : {}),
      ...(input.remoteCountsForWorkday !== undefined ? { remoteCountsForWorkday: input.remoteCountsForWorkday } : {}),
      ...(input.blockRemoteWithoutAgreement !== undefined ? { blockRemoteWithoutAgreement: input.blockRemoteWithoutAgreement } : {}),
      ...(input.requireUnionForCollective !== undefined ? { requireUnionForCollective: input.requireUnionForCollective } : {}),
      ...(input.remoteGeolocationEnabled !== undefined ? { remoteGeolocationEnabled: input.remoteGeolocationEnabled } : {}),
      ...(input.lunchPunchEnabled !== undefined ? { lunchPunchEnabled: input.lunchPunchEnabled } : {}),
      updatedById: actor.id,
    };
    await this.db.nomSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...changes },
      update: changes,
    });

    await this.audit?.({
      action: "NOM_SETTINGS_UPDATED",
      entityType: "NomSettings",
      entityId: tenantId,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: {
        workdayLimitMinutes: previous.workdayLimitMinutes,
        weekStartDay: previous.weekStartDay,
        weeklyLimitMinutes: previous.weeklyLimitMinutes,
        retentionMonths: previous.retentionMonths,
        remotePunchEnabled: previous.remotePunchEnabled,
        remoteCountsForWorkday: previous.remoteCountsForWorkday,
        remoteGeolocationEnabled: previous.remoteGeolocationEnabled,
        lunchPunchEnabled: previous.lunchPunchEnabled,
      },
      newState: { ...input },
    });

    return this.resolve(tenantId);
  }

  /**
   * Guarda la política de teletrabajo/desconexión y el aviso de privacidad del
   * cliente (F2-08). Cada texto modificado incrementa su versión para que el
   * consentimiento del trabajador quede ligado a la versión vigente. Auditado.
   */
  async updatePolicy(
    tenantId: string,
    actor: { id: string; name?: string | null },
    input: TeleworkPolicyUpdateInput
  ): Promise<NomConfig> {
    const previous = await this.resolve(tenantId);
    const current = await this.db.nomSettings.findUnique({ where: { tenantId } });

    if (input.teleworkPolicy != null) {
      const normalized = normalizeText(input.teleworkPolicy);
      const missing = TELEWORK_POLICY_SECTIONS.filter((section) => !normalized.includes(section));
      if (missing.length > 0) {
        throw new HttpError(400, "TELEWORK_POLICY_SECTIONS_MISSING", { missing });
      }
    }

    const policyChanged =
      (input.teleworkPolicy !== undefined && input.teleworkPolicy !== (current?.teleworkPolicy ?? null)) ||
      (input.disconnectPolicy !== undefined && input.disconnectPolicy !== (current?.disconnectPolicy ?? null));
    const privacyChanged =
      input.privacyNotice !== undefined && input.privacyNotice !== (current?.privacyNotice ?? null);

    const nextPolicyVersion = (current?.policyVersion ?? 1) + (policyChanged ? 1 : 0);
    const nextPrivacyVersion = (current?.privacyNoticeVersion ?? 1) + (privacyChanged ? 1 : 0);
    const policiesUpdatedAt = policyChanged || privacyChanged ? new Date() : current?.policiesUpdatedAt ?? null;

    await this.db.nomSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        teleworkPolicy: input.teleworkPolicy ?? null,
        disconnectPolicy: input.disconnectPolicy ?? null,
        privacyNotice: input.privacyNotice ?? null,
        policyVersion: nextPolicyVersion,
        privacyNoticeVersion: nextPrivacyVersion,
        policiesUpdatedAt,
        updatedById: actor.id,
      },
      update: {
        ...(input.teleworkPolicy !== undefined ? { teleworkPolicy: input.teleworkPolicy } : {}),
        ...(input.disconnectPolicy !== undefined ? { disconnectPolicy: input.disconnectPolicy } : {}),
        ...(input.privacyNotice !== undefined ? { privacyNotice: input.privacyNotice } : {}),
        policyVersion: nextPolicyVersion,
        privacyNoticeVersion: nextPrivacyVersion,
        policiesUpdatedAt,
        updatedById: actor.id,
      },
    });

    await this.audit?.({
      action: "NOM_TELEWORK_POLICY_UPDATED",
      entityType: "NomSettings",
      entityId: tenantId,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: {
        policyVersion: previous.policy.policyVersion,
        privacyNoticeVersion: previous.policy.privacyNoticeVersion,
      },
      newState: {
        policyVersion: nextPolicyVersion,
        privacyNoticeVersion: nextPrivacyVersion,
        policyChanged,
        privacyChanged,
      },
    });

    return this.resolve(tenantId);
  }

  /** Clientes con retención configurada (los que el worker de archivado toca). */
  async tenantsWithRetention(): Promise<Array<{ tenantId: string; retentionMonths: number }>> {
    const rows = await this.db.nomSettings.findMany({
      where: { retentionMonths: { not: null } },
      select: { tenantId: true, retentionMonths: true },
    });
    return rows
      .filter((row): row is { tenantId: string; retentionMonths: number } => row.retentionMonths != null)
      .map((row) => ({ tenantId: row.tenantId, retentionMonths: row.retentionMonths }));
  }
}
