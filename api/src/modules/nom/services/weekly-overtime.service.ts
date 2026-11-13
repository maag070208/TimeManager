import type { Prisma, PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { localDateKey } from "@core/utils/timezone";
import type { ScheduleOvertimeDay } from "@modules/schedules/models/entity/schedule.entity";
import { classifyWeeklyOvertime, type WeeklyOvertimeDayInput } from "@modules/overtime/services/weekly-overtime-engine";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { WorkdayCalculator } from "./workday-alerts.service";
import type { HolidayService } from "./holiday.service";

/** Semana de nómina (lunes local) en formato de fecha UTC-medianoche. */
const toUtcDate = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

const ageAt = (birthDate: Date | null, at: Date): number | null => {
  if (!birthDate) return null;
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
};

const streakWithinWeek = (days: ScheduleOvertimeDay[]): number => {
  const worked = new Set(days.filter((day) => day.workedMin > 0).map((day) => day.date));
  return worked.size >= 7 ? 7 : worked.size;
};

/**
 * Ledger semanal de horas extra (F1): toma el cálculo diario que ya usa
 * Horarios, lo clasifica con el motor legal y guarda un snapshot auditable por
 * persona/semana. Mientras está DRAFT se recalcula; al confirmarse se congela.
 */
export class WeeklyOvertimeService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly calculator: WorkdayCalculator,
    private readonly audit?: AuditLogger,
    private readonly holidays?: HolidayService
  ) {}

  private async usersById(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, { birthDate: Date | null }>();
    const rows = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, birthDate: true },
    });
    return new Map(rows.map((row) => [row.id, { birthDate: row.birthDate }]));
  }

  /** Calcula (o recalcula si sigue DRAFT) la semana y devuelve los ledgers. */
  async computeWeek(tenantId: string, date: string): Promise<unknown[]> {
    return this.list(tenantId, await this.refreshWeek(tenantId, date));
  }

  /**
   * Recalcula los ledgers DRAFT de la semana y devuelve su llave de inicio.
   * `computed` evita repetir el cálculo diario cuando el llamador ya lo tiene
   * para esa misma semana (export STPS semanal).
   */
  async refreshWeek(
    tenantId: string,
    date: string,
    computed?: Awaited<ReturnType<WorkdayCalculator["computeOvertimeDays"]>>
  ): Promise<string> {
    const { days, range } =
      computed ??
      (await this.calculator.computeOvertimeDays({
        page: 1,
        limit: 100000,
        filters: { period: "WEEK", date },
        sort: undefined,
      }));
    const weekStartKey = localDateKey(range.start, range.timezone);
    const weekStart = toUtcDate(weekStartKey);
    const userIds = [...new Set(days.map((day) => day.userId))];
    if (userIds.length === 0) return weekStartKey;
    const [users, agreements, holidayDates, existingRows] = await Promise.all([
      this.usersById(userIds),
      this.db.workdayDistributionAgreement.findMany({
        where: {
          tenantId,
          userId: { in: userIds },
          acceptedAt: { not: null },
          effectiveFrom: { lte: range.end },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.start } }],
        },
        select: { userId: true },
      }),
      this.holidays
        ? this.holidays.between(
            tenantId,
            localDateKey(range.start, range.timezone),
            localDateKey(new Date(range.end.getTime() - 1), range.timezone)
          )
        : new Set<string>(),
      this.db.weeklyOvertimeLedger.findMany({
        where: { tenantId, weekStart, userId: { in: userIds } },
        select: { id: true, userId: true, status: true },
      }),
    ]);
    const agreementUsers = new Set<string>();
    for (const agreement of agreements) if (agreement.userId) agreementUsers.add(agreement.userId);
    const existingByUser = new Map(existingRows.map((row) => [row.userId, row]));

    const byUser = new Map<string, ScheduleOvertimeDay[]>();
    for (const day of days) {
      const list = byUser.get(day.userId);
      if (list) list.push(day);
      else byUser.set(day.userId, [day]);
    }

    const writes: Array<Promise<unknown>> = [];
    for (const [userId, personDays] of byUser) {
      const existing = existingByUser.get(userId);
      if (existing && existing.status !== "DRAFT") continue;

      const birthDate = users.get(userId)?.birthDate ?? null;
      const input = personDays
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map<WeeklyOvertimeDayInput>((day) => ({
          date: day.date,
          workedMin: day.workedMin,
          scheduledMin: day.scheduledMin,
          shiftType: day.shiftType ?? "DIURNA",
          restDay: day.restDay,
          holidayWorked: holidayDates.has(day.date) && !day.restDay && day.workedMin > 0,
        }));

      const result = classifyWeeklyOvertime({
        days: input,
        ageAtWeekStart: ageAt(birthDate, weekStart),
        consecutiveWorkedDays: streakWithinWeek(personDays),
        hasDistributionAgreement: agreementUsers.has(userId),
      });

      const data = {
        year: result.year,
        ordinaryMin: result.ordinaryMin,
        otDoubleMin: result.otDoubleMin,
        otTripleMin: result.otTripleMin,
        otIllegalMin: result.otIllegalMin,
        restDayWorkedMin: result.restDayWorkedMin,
        holidayWorkedMin: result.holidayWorkedMin,
        sundayWorked: result.sundayWorked,
        minor: result.minor,
        violations: result.violations as unknown as Prisma.InputJsonValue,
        days: result.days as unknown as Prisma.InputJsonValue,
        engineVersion: result.engineVersion,
      };

      writes.push(
        existing
          ? this.db.weeklyOvertimeLedger.update({ where: { id: existing.id }, data })
          : this.db.weeklyOvertimeLedger.create({ data: { tenantId, userId, weekStart, ...data } })
      );
    }
    // Una fila por persona: las escrituras no dependen entre sí.
    await Promise.all(writes);
    return weekStartKey;
  }

  async list(tenantId: string, weekStartKey?: string): Promise<unknown[]> {
    return this.db.weeklyOvertimeLedger.findMany({
      where: {
        tenantId,
        ...(weekStartKey ? { weekStart: toUtcDate(weekStartKey) } : {}),
      },
      orderBy: [{ weekStart: "desc" }, { userId: "asc" }],
      take: 500,
      include: { user: { select: { name: true, employeeNumber: true } } },
    });
  }

  /** Confirma (congela) el snapshot de una persona/semana. */
  async confirm(tenantId: string, id: string, actor: { id: string; name?: string }) {
    const ledger = await this.db.weeklyOvertimeLedger.findFirst({ where: { id, tenantId } });
    if (!ledger) throw new HttpError(404, "WEEKLY_LEDGER_NOT_FOUND");
    if (ledger.status !== "DRAFT") return ledger;
    const updated = await this.db.weeklyOvertimeLedger.update({
      where: { id: ledger.id },
      data: {
        status: "CONFIRMED",
        confirmedById: actor.id,
        confirmedAt: new Date(),
      },
    });
    await this.audit?.({
      action: "WEEKLY_OVERTIME_CONFIRMED",
      entityType: "WeeklyOvertimeLedger",
      entityId: ledger.id,
      userId: actor.id,
      userName: actor.name,
      previousState: { status: ledger.status },
      newState: { status: "CONFIRMED", otDoubleMin: ledger.otDoubleMin, otTripleMin: ledger.otTripleMin },
    });
    return updated;
  }
}
