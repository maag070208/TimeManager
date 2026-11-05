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

/** Claves globales de `sys_config` que sirven de default de plataforma. */
export const NOM_WORKDAY_LIMIT_CONFIG_KEY = "NOM_WORKDAY_LIMIT_MINUTES";
export const NOM_WEEKLY_LIMIT_CONFIG_KEY = "NOM_WEEKLY_LIMIT_MINUTES";
export const NOM_RETENTION_MONTHS_CONFIG_KEY = "NOM_RETENTION_MONTHS";

/** Tope legal diario (ordinaria + extra): 12 h. */
export const LEGAL_WORKDAY_LIMIT_MINUTES = 720;

/** Topes legales semanales por año (LFT reforma 2027: 46 h → 40 h en 2030). */
export const weeklyLimitForYear = (year: number): number => {
  if (year >= 2030) return 40 * 60;
  if (year >= 2027) return 46 * 60;
  return 48 * 60;
};

export const MIN_WORKDAY_LIMIT_MINUTES = 60;
export const MAX_WORKDAY_LIMIT_MINUTES = 24 * 60;
export const MIN_WEEKLY_LIMIT_MINUTES = 600;
export const MAX_WEEKLY_LIMIT_MINUTES = 7 * 24 * 60;
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
 * sin configurar se calcula por año (46 h 2027-2029, 40 h desde 2030).
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
      this.db.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }),
    ]);
    const timezone = tenant?.timezone ?? "America/Mexico_City";
    const year = Number(localDateKey(new Date(), timezone).slice(0, 4));

    const sysWorkday = await this.sysInt(NOM_WORKDAY_LIMIT_CONFIG_KEY);
    const sysWeekly = await this.sysInt(NOM_WEEKLY_LIMIT_CONFIG_KEY);
    const sysRetention = await this.sysInt(NOM_RETENTION_MONTHS_CONFIG_KEY);
    const legalWeekly = weeklyLimitForYear(year);

    const workdayLimitMinutes =
      settings?.workdayLimitMinutes ?? sysWorkday ?? LEGAL_WORKDAY_LIMIT_MINUTES;
    const weeklyLimitMinutes = settings?.weeklyLimitMinutes ?? sysWeekly ?? legalWeekly;
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
      weeklyLimitMinutes,
      retentionMonths,
      remotePunchEnabled: settings?.remotePunchEnabled ?? true,
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
        input.weeklyLimitMinutes > MAX_WEEKLY_LIMIT_MINUTES)
    ) {
      throw new HttpError(400, "INVALID_WEEKLY_LIMIT", {
        min: MIN_WEEKLY_LIMIT_MINUTES,
        max: MAX_WEEKLY_LIMIT_MINUTES,
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

    await this.db.nomSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        workdayLimitMinutes: input.workdayLimitMinutes ?? null,
        weeklyLimitMinutes: input.weeklyLimitMinutes ?? null,
        retentionMonths: input.retentionMonths ?? null,
        remotePunchEnabled: input.remotePunchEnabled ?? true,
        updatedById: actor.id,
      },
      update: {
        ...(input.workdayLimitMinutes !== undefined
          ? { workdayLimitMinutes: input.workdayLimitMinutes }
          : {}),
        ...(input.weeklyLimitMinutes !== undefined
          ? { weeklyLimitMinutes: input.weeklyLimitMinutes }
          : {}),
        ...(input.retentionMonths !== undefined ? { retentionMonths: input.retentionMonths } : {}),
        ...(input.remotePunchEnabled !== undefined
          ? { remotePunchEnabled: input.remotePunchEnabled }
          : {}),
        updatedById: actor.id,
      },
    });

    await this.audit?.({
      action: "NOM_SETTINGS_UPDATED",
      entityType: "NomSettings",
      entityId: tenantId,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: {
        workdayLimitMinutes: previous.workdayLimitMinutes,
        weeklyLimitMinutes: previous.weeklyLimitMinutes,
        retentionMonths: previous.retentionMonths,
        remotePunchEnabled: previous.remotePunchEnabled,
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
