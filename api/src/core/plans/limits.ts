import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";

/**
 * Límites del plan contratado por un cliente (F3-09/10). El plan es el catálogo
 * administrable; `Tenant.employeeLimit` queda como override explícito de
 * soporte para el límite de personal. Sin plan no hay límite.
 */
export interface TenantLimits {
  people: number | null;
  clocks: number | null;
}

export interface TenantUsage {
  activeUsers: number;
  clocks: number;
}

interface TenantPlanRow {
  employeeLimit: number | null;
  plan: { employeeLimit: number; clockLimit: number } | null;
}

/** Límites efectivos a partir del cliente y su plan. **Puro.** */
export const limitsOf = (tenant: TenantPlanRow | null): TenantLimits => ({
  people: tenant?.employeeLimit ?? tenant?.plan?.employeeLimit ?? null,
  clocks: tenant?.plan?.clockLimit ?? null,
});

/** Uso actual: personas con cuenta activa y relojes dados de alta (`url`). */
export const tenantUsage = async (
  tenantId: string,
  db: PrismaClient = prismaClient
): Promise<TenantUsage> => {
  const [activeUsers, clocks] = await Promise.all([
    db.user.count({ where: { tenantId, active: true } }),
    db.timeClock.count({ where: { tenantId, url: { not: null } } }),
  ]);
  return { activeUsers, clocks };
};

/** Valida capacidad de personal con un límite ya resuelto. **Puro.** */
export const assertPeopleCapacity = (
  limit: number | null,
  usage: number,
  adding = 1
): void => {
  if (limit === null) return;
  if (usage + adding > limit) {
    throw new HttpError(409, "EMPLOYEE_LIMIT_REACHED", { usage, limit });
  }
};

/** Valida capacidad de relojes con un límite ya resuelto. **Puro.** */
export const assertClockCapacity = (
  limit: number | null,
  usage: number,
  adding = 1
): void => {
  if (limit === null) return;
  if (usage + adding > limit) {
    throw new HttpError(409, "CLOCK_LIMIT_REACHED", { usage, limit });
  }
};

const tenantRowOf = (tenantId: string, db: PrismaClient): Promise<TenantPlanRow | null> =>
  db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      employeeLimit: true,
      plan: { select: { employeeLimit: true, clockLimit: true } },
    },
  });

/** ¿La cuenta activa cabe en el plan? 409 `EMPLOYEE_LIMIT_REACHED` si no. */
export const assertCanAddPeople = async (
  tenantId: string | null,
  adding = 1,
  db: PrismaClient = prismaClient
): Promise<void> => {
  if (!tenantId) return;
  const [tenant, usage] = await Promise.all([
    tenantRowOf(tenantId, db),
    db.user.count({ where: { tenantId, active: true } }),
  ]);
  assertPeopleCapacity(limitsOf(tenant).people, usage, adding);
};

/** ¿Cabe un reloj dado de alta? 409 `CLOCK_LIMIT_REACHED` si no. */
export const assertCanAddClock = async (
  tenantId: string | null,
  adding = 1,
  db: PrismaClient = prismaClient
): Promise<void> => {
  if (!tenantId) return;
  const [tenant, usage] = await Promise.all([
    tenantRowOf(tenantId, db),
    db.timeClock.count({ where: { tenantId, url: { not: null } } }),
  ]);
  assertClockCapacity(limitsOf(tenant).clocks, usage, adding);
};
