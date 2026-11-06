import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";
import {
  calculatePayroll,
  type PayrollConfig,
  type PayrollImssRate,
  type PayrollInput,
  type PayrollIsrBracket,
  type PayrollResult,
} from "./payroll-engine";
import type { PayrollSettingsUpdateInput } from "../models/dto/payroll.dto";

const number = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export class PayrollSettingsService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  async get(tenantId: string) {
    const row = await this.db.payrollSettings.findUnique({ where: { tenantId } });
    return {
      currency: row?.currency ?? "MXN",
      defaultDailySalary: number(row?.defaultDailySalary),
      sbcDaily: number(row?.sbcDaily),
      umaDaily: number(row?.umaDaily),
      overtimeHourlyDivisor: row?.overtimeHourlyDivisor ?? 8,
      overtimeDoubleHoursPerWeek: row?.overtimeDoubleHoursPerWeek ?? 9,
      overtimeDoubleMultiplier: number(row?.overtimeDoubleMultiplier) ?? 2,
      overtimeTripleMultiplier: number(row?.overtimeTripleMultiplier) ?? 3,
      aguinaldoDays: row?.aguinaldoDays ?? 15,
      aguinaldoExemptUmas: number(row?.aguinaldoExemptUmas) ?? 30,
      vacationPremiumPct: number(row?.vacationPremiumPct) ?? 25,
      primaVacacionalExemptUmas: number(row?.primaVacacionalExemptUmas) ?? 15,
      valesMonthly: number(row?.valesMonthly),
      valesExemptMonthly: number(row?.valesExemptMonthly),
      fondoAhorroPct: number(row?.fondoAhorroPct),
      fondoAhorroCapMonthly: number(row?.fondoAhorroCapMonthly),
      fondoAhorroExemptMonthly: number(row?.fondoAhorroExemptMonthly),
      ptuRatePct: number(row?.ptuRatePct) ?? 10,
      isrEnabled: row?.isrEnabled ?? false,
      isrBrackets: (row?.isrBrackets ?? null) as PayrollIsrBracket[] | null,
      isrSubsidyMonthly: number(row?.isrSubsidyMonthly),
      imssEnabled: row?.imssEnabled ?? false,
      imssRates: (row?.imssRates ?? null) as PayrollImssRate[] | null,
      primaAntiguedadDaysPerYear: row?.primaAntiguedadDaysPerYear ?? 12,
      primaAntiguedadCapDaily: number(row?.primaAntiguedadCapDaily),
      severanceMonths: number(row?.severanceMonths) ?? 3,
      severanceDaysPerYear: row?.severanceDaysPerYear ?? 20,
    };
  }

  async update(tenantId: string, actor: { id: string; name?: string }, input: PayrollSettingsUpdateInput) {
    const previous = await this.get(tenantId);
    const data = {
      ...(input.currency !== undefined && { currency: input.currency.toUpperCase() }),
      ...(input.defaultDailySalary !== undefined && { defaultDailySalary: input.defaultDailySalary }),
      ...(input.sbcDaily !== undefined && { sbcDaily: input.sbcDaily }),
      ...(input.umaDaily !== undefined && { umaDaily: input.umaDaily }),
      ...(input.overtimeHourlyDivisor !== undefined && { overtimeHourlyDivisor: input.overtimeHourlyDivisor }),
      ...(input.overtimeDoubleHoursPerWeek !== undefined && {
        overtimeDoubleHoursPerWeek: input.overtimeDoubleHoursPerWeek,
      }),
      ...(input.overtimeDoubleMultiplier !== undefined && { overtimeDoubleMultiplier: input.overtimeDoubleMultiplier }),
      ...(input.overtimeTripleMultiplier !== undefined && { overtimeTripleMultiplier: input.overtimeTripleMultiplier }),
      ...(input.aguinaldoDays !== undefined && { aguinaldoDays: input.aguinaldoDays }),
      ...(input.aguinaldoExemptUmas !== undefined && { aguinaldoExemptUmas: input.aguinaldoExemptUmas }),
      ...(input.vacationPremiumPct !== undefined && { vacationPremiumPct: input.vacationPremiumPct }),
      ...(input.primaVacacionalExemptUmas !== undefined && {
        primaVacacionalExemptUmas: input.primaVacacionalExemptUmas,
      }),
      ...(input.valesMonthly !== undefined && { valesMonthly: input.valesMonthly }),
      ...(input.valesExemptMonthly !== undefined && { valesExemptMonthly: input.valesExemptMonthly }),
      ...(input.fondoAhorroPct !== undefined && { fondoAhorroPct: input.fondoAhorroPct }),
      ...(input.fondoAhorroCapMonthly !== undefined && { fondoAhorroCapMonthly: input.fondoAhorroCapMonthly }),
      ...(input.fondoAhorroExemptMonthly !== undefined && {
        fondoAhorroExemptMonthly: input.fondoAhorroExemptMonthly,
      }),
      ...(input.ptuRatePct !== undefined && { ptuRatePct: input.ptuRatePct }),
      ...(input.isrEnabled !== undefined && { isrEnabled: input.isrEnabled }),
      ...(input.isrBrackets !== undefined && { isrBrackets: input.isrBrackets as never }),
      ...(input.isrSubsidyMonthly !== undefined && { isrSubsidyMonthly: input.isrSubsidyMonthly }),
      ...(input.imssEnabled !== undefined && { imssEnabled: input.imssEnabled }),
      ...(input.imssRates !== undefined && { imssRates: input.imssRates as never }),
      ...(input.primaAntiguedadDaysPerYear !== undefined && {
        primaAntiguedadDaysPerYear: input.primaAntiguedadDaysPerYear,
      }),
      ...(input.primaAntiguedadCapDaily !== undefined && {
        primaAntiguedadCapDaily: input.primaAntiguedadCapDaily,
      }),
      ...(input.severanceMonths !== undefined && { severanceMonths: input.severanceMonths }),
      ...(input.severanceDaysPerYear !== undefined && { severanceDaysPerYear: input.severanceDaysPerYear }),
      updatedById: actor.id,
    };
    await this.db.payrollSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    await this.audit?.({
      action: "PAYROLL_SETTINGS_UPDATED",
      entityType: "PayrollSettings",
      entityId: tenantId,
      userId: actor.id,
      userName: actor.name,
      previousState: previous as unknown as Record<string, unknown>,
      newState: { ...input },
    });
    return this.get(tenantId);
  }

  async listPositions(tenantId: string) {
    const rows = await this.db.payrollPosition.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { users: { where: { active: true }, select: { id: true, name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      jobTitle: row.jobTitle,
      dailySalary: Number(row.dailySalary),
      sbcDaily: number(row.sbcDaily),
      active: row.active,
      employees: row.users,
    }));
  }

  async createPosition(
    tenantId: string,
    actor: { id: string; name?: string },
    input: { name: string; jobTitle?: string | null; dailySalary: number; sbcDaily?: number | null }
  ) {
    const row = await this.db.payrollPosition.create({
      data: {
        tenantId,
        name: input.name.trim(),
        jobTitle: input.jobTitle?.trim() || null,
        dailySalary: input.dailySalary,
        sbcDaily: input.sbcDaily ?? null,
      },
    });
    await this.audit?.({ action: "PAYROLL_POSITION_CREATED", entityType: "PayrollPosition", entityId: row.id, userId: actor.id, userName: actor.name, newState: { name: row.name, dailySalary: Number(row.dailySalary) } });
    return this.listPositions(tenantId).then((rows) => rows.find((item) => item.id === row.id));
  }

  async updatePosition(
    tenantId: string,
    id: string,
    actor: { id: string; name?: string },
    input: { name?: string; jobTitle?: string | null; dailySalary?: number; sbcDaily?: number | null; active?: boolean }
  ) {
    const existing = await this.db.payrollPosition.findFirst({ where: { id, tenantId } });
    if (!existing) throw new HttpError(404, "PAYROLL_POSITION_NOT_FOUND");
    await this.db.payrollPosition.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle?.trim() || null }),
        ...(input.dailySalary !== undefined && { dailySalary: input.dailySalary }),
        ...(input.sbcDaily !== undefined && { sbcDaily: input.sbcDaily }),
        ...(input.active !== undefined && { active: input.active }),
      },
    });
    await this.audit?.({ action: "PAYROLL_POSITION_UPDATED", entityType: "PayrollPosition", entityId: id, userId: actor.id, userName: actor.name, newState: { ...input } });
    return this.listPositions(tenantId).then((rows) => rows.find((item) => item.id === id));
  }

  async assignPosition(tenantId: string, id: string, userIds: string[]) {
    const existing = await this.db.payrollPosition.findFirst({ where: { id, tenantId } });
    if (!existing) throw new HttpError(404, "PAYROLL_POSITION_NOT_FOUND");
    await this.db.$transaction([
      this.db.user.updateMany({
        where: { tenantId, payrollPositionId: id, id: { notIn: userIds } },
        data: { payrollPositionId: null },
      }),
      this.db.user.updateMany({
        where: { tenantId, id: { in: userIds } },
        data: { payrollPositionId: id },
      }),
    ]);
    const rows = await this.listPositions(tenantId);
    return rows.find((item) => item.id === id);
  }

  async calculate(tenantId: string, input: PayrollInput): Promise<PayrollResult> {
    const settings = await this.get(tenantId);
    if (!settings.defaultDailySalary && !input.dailySalary) throw new Error("PAYROLL_SALARY_REQUIRED");
    const config: PayrollConfig = {
      ...settings,
      dailySalary: settings.defaultDailySalary,
      isrBrackets: settings.isrBrackets,
      imssRates: settings.imssRates,
    };
    try {
      return calculatePayroll(input, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("PAYROLL_")) {
        throw new HttpError(
          400,
          message as "PAYROLL_SALARY_REQUIRED" | "PAYROLL_ISR_TABLE_REQUIRED" | "PAYROLL_IMSS_TABLE_REQUIRED"
        );
      }
      throw error;
    }
  }
}
