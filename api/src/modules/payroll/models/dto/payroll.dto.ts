import { z } from "zod";
import { registry } from "@core/swagger/registry";

const nullableNumber = z.number().min(0).nullable().optional();

export const PayrollSettingsUpdateDto = registry.register(
  "PayrollSettingsUpdate",
  z
    .object({
      currency: z.string().length(3).optional(),
      defaultDailySalary: nullableNumber,
      sbcDaily: nullableNumber,
      umaDaily: nullableNumber,
      overtimeHourlyDivisor: z.number().int().min(1).max(24).optional(),
      overtimeDoubleHoursPerWeek: z.number().int().min(0).max(40).optional(),
      overtimeDoubleMultiplier: z.number().min(1).max(10).optional(),
      overtimeTripleMultiplier: z.number().min(1).max(10).optional(),
      aguinaldoDays: z.number().int().min(0).max(60).optional(),
      aguinaldoExemptUmas: z.number().min(0).max(200).optional(),
      vacationPremiumPct: z.number().min(0).max(100).optional(),
      primaVacacionalExemptUmas: z.number().min(0).max(200).optional(),
      valesMonthly: nullableNumber,
      valesExemptMonthly: nullableNumber,
      fondoAhorroPct: z.number().min(0).max(100).nullable().optional(),
      fondoAhorroCapMonthly: nullableNumber,
      fondoAhorroExemptMonthly: nullableNumber,
      ptuRatePct: z.number().min(0).max(100).optional(),
      isrEnabled: z.boolean().optional(),
      isrBrackets: z
        .array(
          z.object({
            lower: z.number().min(0),
            fixed: z.number().min(0),
            rate: z.number().min(0).max(1),
          })
        )
        .nullable()
        .optional(),
      isrSubsidyMonthly: nullableNumber,
      imssEnabled: z.boolean().optional(),
      imssRates: z
        .array(
          z.object({
            key: z.string().min(1),
            label: z.string().min(1),
            workerPct: z.number().min(0).max(100),
            employerPct: z.number().min(0).max(100),
          })
        )
        .nullable()
        .optional(),
      primaAntiguedadDaysPerYear: z.number().int().min(0).max(60).optional(),
      primaAntiguedadCapDaily: nullableNumber,
      severanceMonths: z.number().min(0).max(24).optional(),
      severanceDaysPerYear: z.number().int().min(0).max(60).optional(),
    })
    .strict()
);

export const PayrollCalculateDto = registry.register(
  "PayrollCalculate",
  z
    .object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      daysWorked: z.number().int().min(0).max(366).optional(),
      dailySalary: nullableNumber,
      overtimeDoubleHours: z.number().min(0).max(200).optional(),
      overtimeTripleHours: z.number().min(0).max(200).optional(),
      vacationDays: z.number().min(0).max(366).optional(),
      accruedVacationDays: z.number().min(0).max(366).optional(),
      daysWorkedYear: z.number().int().min(0).max(366).optional(),
      includeAguinaldo: z.boolean().optional(),
      vales: nullableNumber,
      fondoAhorro: nullableNumber,
      ptuProfit: z.number().min(0).optional(),
      ptuTotalDays: z.number().min(0).optional(),
      ptuTotalSalary: z.number().min(0).optional(),
      termination: z
        .object({
          type: z.enum(["RESIGNATION", "UNJUSTIFIED", "JUSTIFIED", "CONTRACT_END"]),
          years: z.number().min(0).max(80),
          pendingSalaryDays: z.number().min(0).max(366).optional(),
          accruedVacationDays: z.number().min(0).max(366).optional(),
        })
        .optional(),
    })
    .strict()
);

export type PayrollSettingsUpdateInput = z.infer<typeof PayrollSettingsUpdateDto>;
export type PayrollCalculateInput = z.infer<typeof PayrollCalculateDto>;

export const PayrollPositionCreateDto = z.object({
  name: z.string().trim().min(2).max(100),
  jobTitle: z.string().trim().max(120).nullish(),
  dailySalary: z.number().positive(),
  sbcDaily: z.number().positive().nullish(),
}).strict();

export const PayrollPositionUpdateDto = PayrollPositionCreateDto.partial().extend({
  active: z.boolean().optional(),
}).strict();

export const PayrollPositionAssignDto = z.object({
  userIds: z.array(z.string().uuid()).max(500),
}).strict();
