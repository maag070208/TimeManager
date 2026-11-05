import { randomBytes } from "node:crypto";
import { Prisma, type Plan, type PrismaClient, type Tenant } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { hashPassword } from "@core/utils/security";
import { DEFAULT_TIMEZONE } from "@core/utils/timezone";
import { forgetTenantBrand, runWithTenant, seedTenantTemplateCatalogs, tenantTransaction } from "@core/tenancy";
import { assertPeopleCapacity, limitsOf, tenantUsage, type TenantUsage } from "@core/plans";
import { webLoginUrl } from "@core/config/web-url";
import { systemLanguage } from "@core/i18n";
import { enqueueEmail } from "@core/services/email-queue";
import { tenantWelcomeEmail } from "@core/services/email-templates";
import type { AuditLogger } from "@modules/users/services/user.service";
import type {
  TenantCreateInput,
  TenantCreated,
  TenantUpdateInput,
  TenantView,
} from "../models/dto/tenant.dto";

const CLIENT_ADMIN_ROLE = "CLIENT_ADMIN";

interface Actor {
  id: string;
  username: string;
}

type TenantWithPlan = Tenant & { plan: Plan | null };

const toView = (t: TenantWithPlan, usage: TenantUsage): TenantView => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  status: t.status,
  timezone: t.timezone,
  planId: t.planId,
  plan: t.plan
    ? {
        id: t.plan.id,
        key: t.plan.key,
        name: t.plan.name,
        employeeLimit: t.plan.employeeLimit,
        clockLimit: t.plan.clockLimit,
        monthlyPrice: t.plan.monthlyPrice?.toFixed(2) ?? null,
        active: t.plan.active,
      }
    : null,
  employeeLimit: t.employeeLimit,
  brandColor: t.brandColor,
  logoDataUrl: t.logoDataUrl,
  emailFrom: t.emailFrom,
  limits: limitsOf(t),
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  usage,
});

/** Contraseña provisional legible (sin caracteres ambiguos); se cambia al entrar. */
const temporaryPassword = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
};

/**
 * Clientes de la plataforma (F1A-06). Todo corre fuera de contexto de cliente
 * (`runWithTenant(null)`), aunque ADMIN/SUPPORT traigan `X-Tenant-Id`: la tabla
 * `tenants` y los conteos son de plataforma.
 */
export class TenantService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  list(): Promise<TenantView[]> {
    return runWithTenant(null, async () => {
      const [tenants, userCounts, clockCounts] = await Promise.all([
        this.db.tenant.findMany({ include: { plan: true }, orderBy: { name: "asc" } }),
        this.db.user.groupBy({
          by: ["tenantId"],
          where: { active: true, tenantId: { not: null } },
          _count: { _all: true },
        }),
        this.db.timeClock.groupBy({
          by: ["tenantId"],
          where: { url: { not: null } },
          _count: { _all: true },
        }),
      ]);
      const activeUsers = new Map(userCounts.map((c) => [c.tenantId, c._count._all]));
      const clocks = new Map(clockCounts.map((c) => [c.tenantId, c._count._all]));
      return tenants.map((t) =>
        toView(t, { activeUsers: activeUsers.get(t.id) ?? 0, clocks: clocks.get(t.id) ?? 0 })
      );
    }, true);
  }

  getById(id: string): Promise<TenantView> {
    return runWithTenant(null, async () => {
      const tenant = await this.db.tenant.findUnique({ where: { id }, include: { plan: true } });
      if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND");
      return toView(tenant, await tenantUsage(id, this.db));
    }, true);
  }

  /** Resuelve el plan a contratar; un plan dado de baja no se asigna. */
  private async planOf(planId: string | null | undefined): Promise<Plan | null> {
    if (!planId) return null;
    const plan = await this.db.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new HttpError(404, "PLAN_NOT_FOUND");
    if (!plan.active) throw new HttpError(409, "PLAN_INACTIVE", { key: plan.key });
    return plan;
  }

  /** Alta de cliente: tenant + su CLIENT_ADMIN (contraseña provisional) + catálogos plantilla. */
  async create(input: TenantCreateInput, actor: Actor): Promise<TenantCreated> {
    const generated = input.admin.password ? undefined : temporaryPassword();
    const password = await hashPassword(input.admin.password ?? generated!);

    const { tenant, admin } = await runWithTenant(null, async () => {
      const plan = await this.planOf(input.planId);
      assertPeopleCapacity(
        limitsOf({ employeeLimit: input.employeeLimit ?? null, plan }).people,
        0
      );
      try {
        return await tenantTransaction(this.db, async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              name: input.name,
              slug: input.slug,
              timezone: input.timezone ?? DEFAULT_TIMEZONE,
              planId: plan?.id ?? null,
              employeeLimit: input.employeeLimit ?? null,
            },
          });
          const admin = await tx.user.create({
            data: {
              tenantId: tenant.id,
              username: input.admin.username,
              name: input.admin.name,
              email: input.admin.email ?? null,
              password,
              mustChangePassword: true,
              role: CLIENT_ADMIN_ROLE,
            },
            select: { id: true, username: true },
          });
          await this.audit?.(
            {
              action: "TENANT_CREATED",
              entityType: "Tenant",
              entityId: tenant.id,
              userId: actor.id,
              userName: actor.username,
              newState: {
                name: tenant.name,
                slug: tenant.slug,
                status: tenant.status,
                planId: tenant.planId,
                adminId: admin.id,
              },
            },
            tx
          );
          return { tenant, admin };
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new HttpError(409, "TENANT_SLUG_TAKEN", { slug: input.slug });
        }
        throw err;
      }
    }, true);

    const created = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      include: { plan: true },
    });
    const catalogs = await seedTenantTemplateCatalogs(tenant.id, this.db);
    const welcomeSent = await this.sendWelcome(tenant, input, generated);
    return {
      tenant: toView(created, { activeUsers: 1, clocks: 0 }),
      admin,
      welcomeEmail: welcomeSent ? input.admin.email! : null,
      ...(generated ? { temporaryPassword: generated } : {}),
      catalogs,
    };
  }

  /**
   * Bienvenida al administrador del cliente (si tiene correo): entrada por su
   * subdominio, usuario y contraseña provisional. Se encola en el contexto del
   * cliente para que la bitácora de correo sea suya.
   */
  private async sendWelcome(tenant: Tenant, input: TenantCreateInput, temporaryPassword?: string): Promise<boolean> {
    const to = input.admin.email;
    if (!to) return false;
    const { subject, html } = tenantWelcomeEmail({
      language: await systemLanguage(),
      company: tenant.name,
      name: input.admin.name,
      username: input.admin.username,
      tempPassword: temporaryPassword ?? input.admin.password,
      loginUrl: webLoginUrl(tenant.slug),
    });
    return runWithTenant(tenant.id, () =>
      enqueueEmail({ to, subject, html, action: "tenant.create", entityType: "Tenant", entityId: tenant.id })
    );
  }

  async update(id: string, input: TenantUpdateInput, actor: Actor): Promise<TenantView> {
    return runWithTenant(null, async () => {
      const previous = await this.db.tenant.findUnique({ where: { id }, include: { plan: true } });
      if (!previous) throw new HttpError(404, "TENANT_NOT_FOUND");

      const plan = input.planId !== undefined ? await this.planOf(input.planId) : undefined;
      const updated = await this.db.tenant.update({
        where: { id },
        data: {
          name: input.name,
          status: input.status,
          timezone: input.timezone,
          employeeLimit: input.employeeLimit,
          ...(input.brandColor !== undefined ? { brandColor: input.brandColor } : {}),
          ...(input.logoDataUrl !== undefined ? { logoDataUrl: input.logoDataUrl } : {}),
          ...(input.emailFrom !== undefined ? { emailFrom: input.emailFrom } : {}),
          ...(plan !== undefined ? { planId: plan?.id ?? null } : {}),
        },
        include: { plan: true },
      });
      forgetTenantBrand(id);
      await this.audit?.({
        action: previous.status !== updated.status
          ? (updated.status === "SUSPENDED" ? "TENANT_SUSPENDED" : "TENANT_REACTIVATED")
          : "TENANT_UPDATED",
        entityType: "Tenant",
        entityId: id,
        userId: actor.id,
        userName: actor.username,
        previousState: {
          name: previous.name,
          status: previous.status,
          timezone: previous.timezone,
          planId: previous.planId,
          employeeLimit: previous.employeeLimit,
          brandColor: previous.brandColor,
          logoDataUrl: previous.logoDataUrl,
          emailFrom: previous.emailFrom,
        },
        newState: {
          name: updated.name,
          status: updated.status,
          timezone: updated.timezone,
          planId: updated.planId,
          employeeLimit: updated.employeeLimit,
          brandColor: updated.brandColor,
          logoDataUrl: updated.logoDataUrl,
          emailFrom: updated.emailFrom,
        },
      });
      return toView(updated, await tenantUsage(id, this.db));
    }, true);
  }

  /**
   * "Entrar como cliente" (F3-03): no cambia el token ni la sesión — el personal
   * de plataforma sigue operando con `X-Tenant-Id` — pero deja el evento de
   * auditoría de quién entró y a qué cliente. Un cliente suspendido no se
   * registra porque tampoco se podría operar como él (el header lo rechaza).
   */
  impersonate(id: string, actor: Actor): Promise<TenantView> {
    return runWithTenant(null, async () => {
      const tenant = await this.db.tenant.findUnique({ where: { id }, include: { plan: true } });
      if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND");
      if (tenant.status !== "ACTIVE") throw new HttpError(400, "INVALID_TENANT_HEADER");
      await this.audit?.({
        action: "TENANT_IMPERSONATED",
        entityType: "Tenant",
        entityId: tenant.id,
        userId: actor.id,
        userName: actor.username,
        metadata: { tenantId: tenant.id, slug: tenant.slug, name: tenant.name },
      });
      return toView(tenant, await tenantUsage(id, this.db));
    }, true);
  }
}
