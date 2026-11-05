import { z, registry } from "@core/swagger/registry";

const EmployeeLimitSchema = z.number().int().positive().max(1_000_000);
const ClockLimitSchema = z.number().int().positive().max(10_000);

/** Plan del catálogo (F3-09). El precio es de lista: el cobro va por fuera. */
export const PlanSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    employeeLimit: z.number().int(),
    clockLimit: z.number().int(),
    /** Precio mensual de lista; `null` = por definir. */
    monthlyPrice: z.string().nullable(),
    active: z.boolean(),
    sortOrder: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Plan");

export type PlanView = z.infer<typeof PlanSchema>;

/** Clave estable del plan: mayúsculas, números, guion bajo y guion. */
const PlanKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9][A-Z0-9_-]{0,49}$/, "INVALID_PLAN_KEY");

export const PlanCreateDto = z
  .object({
    /** Sin clave se deriva del nombre (`Básico` → `BASICO`). */
    key: PlanKeySchema.optional(),
    name: z.string().trim().min(2).max(80),
    employeeLimit: EmployeeLimitSchema,
    clockLimit: ClockLimitSchema,
    monthlyPrice: z.number().min(0).max(10_000_000).nullish(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .openapi("PlanCreate");

export type PlanCreateInput = z.infer<typeof PlanCreateDto>;

export const PlanUpdateDto = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    employeeLimit: EmployeeLimitSchema.optional(),
    clockLimit: ClockLimitSchema.optional(),
    monthlyPrice: z.number().min(0).max(10_000_000).nullish(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "EMPTY_UPDATE")
  .openapi("PlanUpdate");

export type PlanUpdateInput = z.infer<typeof PlanUpdateDto>;

export { registry };
