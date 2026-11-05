import type { Plan, PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { PlanCreateInput, PlanUpdateInput, PlanView } from "../models/dto/plan.dto";

interface Actor {
  id: string;
  username: string;
}

const toView = (plan: Plan): PlanView => ({
  id: plan.id,
  key: plan.key,
  name: plan.name,
  employeeLimit: plan.employeeLimit,
  clockLimit: plan.clockLimit,
  monthlyPrice: plan.monthlyPrice?.toFixed(2) ?? null,
  active: plan.active,
  sortOrder: plan.sortOrder,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
});

/** Clave derivada del nombre: `Básico` → `BASICO`, `Plan 500` → `PLAN_500`. */
const keyFromName = (name: string): string => {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return key || "PLAN";
};

/**
 * Catálogo de planes del SaaS (F3-09). Es de plataforma: no lleva `tenantId` y
 * solo se administra desde la consola con `plans.view` / `plans.manage`.
 * La baja es lógica (`active=false`): los clientes que ya lo tienen lo
 * conservan y sus datos no se tocan.
 */
export class PlanService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  async list(includeInactive = false): Promise<PlanView[]> {
    const plans = await this.db.plan.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return plans.map(toView);
  }

  async getById(id: string): Promise<PlanView> {
    const plan = await this.db.plan.findUnique({ where: { id } });
    if (!plan) throw new HttpError(404, "PLAN_NOT_FOUND");
    return toView(plan);
  }

  async create(input: PlanCreateInput, actor: Actor): Promise<PlanView> {
    const key = input.key ?? keyFromName(input.name);
    const exists = await this.db.plan.findUnique({ where: { key }, select: { id: true } });
    if (exists) throw new HttpError(409, "PLAN_KEY_TAKEN", { key });

    const plan = await this.db.plan.create({
      data: {
        key,
        name: input.name,
        employeeLimit: input.employeeLimit,
        clockLimit: input.clockLimit,
        monthlyPrice: input.monthlyPrice ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await this.audit?.({
      action: "PLAN_CREATED",
      entityType: "Plan",
      entityId: plan.id,
      userId: actor.id,
      userName: actor.username,
      newState: { key: plan.key, name: plan.name, employeeLimit: plan.employeeLimit, clockLimit: plan.clockLimit },
    });
    return toView(plan);
  }

  async update(id: string, input: PlanUpdateInput, actor: Actor): Promise<PlanView> {
    const previous = await this.db.plan.findUnique({ where: { id } });
    if (!previous) throw new HttpError(404, "PLAN_NOT_FOUND");

    const plan = await this.db.plan.update({
      where: { id },
      data: {
        name: input.name,
        employeeLimit: input.employeeLimit,
        clockLimit: input.clockLimit,
        monthlyPrice: input.monthlyPrice,
        sortOrder: input.sortOrder,
        active: input.active,
      },
    });
    await this.audit?.({
      action:
        previous.active && plan.active === false
          ? "PLAN_DEACTIVATED"
          : !previous.active && plan.active
            ? "PLAN_REACTIVATED"
            : "PLAN_UPDATED",
      entityType: "Plan",
      entityId: plan.id,
      userId: actor.id,
      userName: actor.username,
      previousState: toView(previous),
      newState: toView(plan),
    });
    return toView(plan);
  }

  /** Baja lógica: los clientes que lo tienen lo conservan (no se borra nada). */
  async deactivate(id: string, actor: Actor): Promise<PlanView> {
    return this.update(id, { active: false }, actor);
  }
}
