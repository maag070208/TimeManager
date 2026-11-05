import { z } from "@core/swagger/registry";
import { isValidTimezone } from "@core/utils/timezone";

/** Subdominios que no pueden ser de un cliente (plataforma e infraestructura). */
export const RESERVED_SLUGS = ["app", "admin", "api", "www", "static", "cdn", "mail"] as const;

const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "INVALID_TENANT_SLUG")
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), "RESERVED_TENANT_SLUG");

const TimezoneSchema = z.string().trim().refine(isValidTimezone, "INVALID_TIMEZONE");

export const TenantStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

/** Plan contratado, tal como lo resume la ficha del cliente. */
export const TenantPlanSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    employeeLimit: z.number().int(),
    clockLimit: z.number().int(),
    monthlyPrice: z.string().nullable(),
    active: z.boolean(),
  })
  .openapi("TenantPlan");

export const TenantSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    status: TenantStatusSchema,
    timezone: z.string(),
    planId: z.string().nullable(),
    plan: TenantPlanSchema.nullable(),
    employeeLimit: z.number().int().nullable(),
    /** Límites efectivos (plan + override del cliente). */
    limits: z.object({ people: z.number().int().nullable(), clocks: z.number().int().nullable() }),
    createdAt: z.string(),
    updatedAt: z.string(),
    usage: z.object({ activeUsers: z.number().int(), clocks: z.number().int() }),
  })
  .openapi("Tenant");

export type TenantView = z.infer<typeof TenantSchema>;

export const TenantCreateDto = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: SlugSchema,
    timezone: TimezoneSchema.optional(),
    planId: z.string().trim().min(1).nullish(),
    employeeLimit: z.number().int().positive().nullish(),
    admin: z.object({
      name: z.string().trim().min(2).max(120),
      username: z.string().trim().min(3).max(60),
      email: z.string().trim().email().nullish(),
      /** Sin contraseña se genera una provisional y se devuelve una sola vez. */
      password: z.string().min(8).max(128).optional(),
    }),
  })
  .openapi("TenantCreate");

export type TenantCreateInput = z.infer<typeof TenantCreateDto>;

export const TenantUpdateDto = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    status: TenantStatusSchema.optional(),
    timezone: TimezoneSchema.optional(),
    planId: z.string().trim().min(1).nullish(),
    employeeLimit: z.number().int().positive().nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, "EMPTY_UPDATE")
  .openapi("TenantUpdate");

export type TenantUpdateInput = z.infer<typeof TenantUpdateDto>;

export const TenantCreatedSchema = z
  .object({
    tenant: TenantSchema,
    admin: z.object({ id: z.string(), username: z.string() }),
    /** Solo cuando la generó el API: no se vuelve a mostrar. */
    temporaryPassword: z.string().optional(),
    /** Correo al que se encoló la bienvenida; `null` si el administrador no tiene correo. */
    welcomeEmail: z.string().nullable(),
    catalogs: z.object({ removalCategories: z.number().int(), documentTypes: z.number().int() }),
  })
  .openapi("TenantCreated");

export type TenantCreated = z.infer<typeof TenantCreatedSchema>;
