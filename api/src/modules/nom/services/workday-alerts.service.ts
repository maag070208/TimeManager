import type { PrismaClient, WorkdayAlertScope } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { logger } from "@core/utils/logger";
import { localDateKey } from "@core/utils/timezone";
import type { ITDataTableFetchParams } from "@core/utils/table";
import type { ScheduleOvertimeDay } from "@modules/schedules/models/entity/schedule.entity";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { NotificationPort } from "@modules/notifications";
import { forEachActiveTenant } from "@core/tenancy";
import type {
  AlertScanInput,
  AlertScanResult,
  WorkdayAlertDto,
} from "../models/entity/nom.entity";
import type { NomSettingsService } from "./nom-settings.service";

/** Puerto del cálculo diario de jornada (lo implementa `schedules`). */
export interface WorkdayCalculator {
  computeOvertimeDays(params: ITDataTableFetchParams): Promise<{
    days: ScheduleOvertimeDay[];
    range: { start: Date; end: Date; timezone: string; period: string };
  }>;
}

type AlertRow = {
  id: string;
  scope: WorkdayAlertScope;
  date: Date;
  userId: string;
  workedMinutes: number;
  limitMinutes: number;
  notifyCount: number;
  notifiedAt: Date;
  createdAt: Date;
  user?: { name: string; employeeNumber: string | null } | null;
};

const toDateOnly = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

/**
 * Alertas de límite de jornada (F2-03).
 *
 * Barre el cálculo diario/semanal que ya usa Horarios (`computeOvertimeDays`),
 * compara contra los límites efectivos del cliente (12 h/día; tope semanal por
 * año, configurable) y, al detectar un exceso, persiste la alerta y avisa a RH
 * (campanita + correo por la cola). Una alerta por persona/escala/día: el
 * barrido es idempotente y no repite el aviso.
 */
export class WorkdayAlertsService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly calculator: WorkdayCalculator,
    private readonly settings: NomSettingsService,
    private readonly notifications?: NotificationPort,
    private readonly audit?: AuditLogger
  ) {}

  private async timezoneOf(tenantId: string): Promise<string> {
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    return tenant?.timezone ?? "America/Mexico_City";
  }

  private toDto(row: AlertRow): WorkdayAlertDto {
    return {
      id: row.id,
      scope: row.scope,
      date: row.date.toISOString().slice(0, 10),
      userId: row.userId,
      userName: row.user?.name ?? null,
      employeeNumber: row.user?.employeeNumber ?? null,
      workedMinutes: row.workedMinutes,
      limitMinutes: row.limitMinutes,
      notifyCount: row.notifyCount,
      notifiedAt: row.notifiedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Registra la alerta si es nueva; avisa a RH y lo audita en ese momento.
   * Devuelve `null` si ya existía (barrido repetido).
   */
  private async recordAlert(input: {
    tenantId: string;
    userId: string;
    employeeName: string;
    scope: WorkdayAlertScope;
    dateKey: string;
    workedMinutes: number;
    limitMinutes: number;
  }): Promise<WorkdayAlertDto | null> {
    const date = toDateOnly(input.dateKey);
    const existing = await this.db.workdayLimitAlert.findUnique({
      where: {
        tenantId_userId_scope_date: {
          tenantId: input.tenantId,
          userId: input.userId,
          scope: input.scope,
          date,
        },
      },
    });
    if (existing) {
      if (input.workedMinutes > existing.workedMinutes) {
        await this.db.workdayLimitAlert.update({
          where: { id: existing.id },
          data: { workedMinutes: input.workedMinutes },
        });
      }
      return null;
    }

    const alert = await this.db.workdayLimitAlert.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        scope: input.scope,
        date,
        workedMinutes: input.workedMinutes,
        limitMinutes: input.limitMinutes,
      },
    });

    const notified = await this.notifications?.notifyWorkdayLimit({
      employeeName: input.employeeName,
      date: input.dateKey,
      workedMinutes: input.workedMinutes,
      limitMinutes: input.limitMinutes,
      scope: input.scope === "DAY" ? "day" : "week",
    });
    const notifyCount = notified?.count ?? 0;
    if (notifyCount > 0) {
      await this.db.workdayLimitAlert.update({
        where: { id: alert.id },
        data: { notifyCount },
      });
    }

    await this.audit?.({
      action: "WORKDAY_LIMIT_ALERT",
      entityType: "WorkdayLimitAlert",
      entityId: alert.id,
      previousState: { limitMinutes: input.limitMinutes },
      newState: { workedMinutes: input.workedMinutes, scope: input.scope, date: input.dateKey },
      metadata: { employeeId: input.userId, notifiedRecipients: notifyCount },
    });

    const row = await this.db.workdayLimitAlert.findUniqueOrThrow({
      where: { id: alert.id },
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
    return this.toDto(row);
  }

  /** Revisa un día local (y/o la semana que lo contiene) y emite alertas nuevas. */
  async scan(tenantId: string, input: AlertScanInput = {}): Promise<AlertScanResult> {
    const config = await this.settings.resolve(tenantId);
    const timezone = await this.timezoneOf(tenantId);
    const dateKey = input.date ?? localDateKey(new Date(Date.now() - 86_400_000), timezone);
    const scope = input.scope ?? "ALL";
    const created: WorkdayAlertDto[] = [];
    let evaluatedDays = 0;
    let evaluatedWeeks = 0;

    if (scope === "DAY" || scope === "ALL") {
      const { days } = await this.calculator.computeOvertimeDays({
        page: 1,
        limit: 100000,
        filters: { period: "DAY", date: dateKey },
        sort: undefined,
      });
      evaluatedDays = 1;
      for (const day of days) {
        if (day.workedMin <= config.workdayLimitMinutes) continue;
        const alert = await this.recordAlert({
          tenantId,
          userId: day.userId,
          employeeName: day.employeeName,
          scope: "DAY",
          dateKey: day.date,
          workedMinutes: day.workedMin,
          limitMinutes: config.workdayLimitMinutes,
        });
        if (alert) created.push(alert);
      }
    }

    if (scope === "WEEK" || scope === "ALL") {
      const { days, range } = await this.calculator.computeOvertimeDays({
        page: 1,
        limit: 100000,
        filters: { period: "WEEK", date: dateKey },
        sort: undefined,
      });
      evaluatedWeeks = 1;
      const byUser = new Map<string, { userId: string; employeeName: string; workedMinutes: number }>();
      for (const day of days) {
        const current = byUser.get(day.userId);
        if (current) current.workedMinutes += day.workedMin;
        else
          byUser.set(day.userId, {
            userId: day.userId,
            employeeName: day.employeeName,
            workedMinutes: day.workedMin,
          });
      }
      const weekAnchor = localDateKey(range.start, timezone);
      for (const row of byUser.values()) {
        if (row.workedMinutes <= config.weeklyLimitMinutes) continue;
        const alert = await this.recordAlert({
          tenantId,
          userId: row.userId,
          employeeName: row.employeeName,
          scope: "WEEK",
          dateKey: weekAnchor,
          workedMinutes: row.workedMinutes,
          limitMinutes: config.weeklyLimitMinutes,
        });
        if (alert) created.push(alert);
      }
    }

    return { date: dateKey, scope, created, evaluatedDays, evaluatedWeeks };
  }

  /** Barrido de ayer para todos los clientes activos (worker). */
  async scanAllTenants(): Promise<void> {
    await forEachActiveTenant(async (tenant) => {
      const result = await this.scan(tenant.id, { scope: "ALL" });
      if (result.created.length > 0) {
        logger.info(
          `[nom] cliente ${tenant.slug}: ${result.created.length} alerta(s) de límite de jornada`
        );
      }
    });
  }

  async list(params: { scope?: WorkdayAlertScope; limit?: number } = {}): Promise<WorkdayAlertDto[]> {
    const rows = await this.db.workdayLimitAlert.findMany({
      where: params.scope ? { scope: params.scope } : undefined,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: params.limit ?? 100,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
    return rows.map((row) => this.toDto(row));
  }
}
