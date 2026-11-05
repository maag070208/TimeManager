import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient, type Tenant } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { hashPassword } from "@core/utils/security";
import { DEFAULT_TIMEZONE } from "@core/utils/timezone";
import { runWithTenant, seedTenantTemplateCatalogs } from "@core/tenancy";
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

const toView = (t: Tenant, activeUsers: number): TenantView => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  status: t.status,
  timezone: t.timezone,
  plan: t.plan,
  employeeLimit: t.employeeLimit,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  usage: { activeUsers },
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
      const [tenants, counts] = await Promise.all([
        this.db.tenant.findMany({ orderBy: { name: "asc" } }),
        this.db.user.groupBy({
          by: ["tenantId"],
          where: { active: true, tenantId: { not: null } },
          _count: { _all: true },
        }),
      ]);
      const byTenant = new Map(counts.map((c) => [c.tenantId, c._count._all]));
      return tenants.map((t) => toView(t, byTenant.get(t.id) ?? 0));
    }, true);
  }

  getById(id: string): Promise<TenantView> {
    return runWithTenant(null, async () => {
      const tenant = await this.db.tenant.findUnique({ where: { id } });
      if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND");
      const activeUsers = await this.db.user.count({ where: { tenantId: id, active: true } });
      return toView(tenant, activeUsers);
    }, true);
  }

  /** Alta de cliente: tenant + su CLIENT_ADMIN (contraseña provisional) + catálogos plantilla. */
  async create(input: TenantCreateInput, actor: Actor): Promise<TenantCreated> {
    const generated = input.admin.password ? undefined : temporaryPassword();
    const password = await hashPassword(input.admin.password ?? generated!);

    const { tenant, admin } = await runWithTenant(null, async () => {
      try {
        return await this.db.$transaction(async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              name: input.name,
              slug: input.slug,
              timezone: input.timezone ?? DEFAULT_TIMEZONE,
              plan: input.plan ?? null,
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
              newState: { name: tenant.name, slug: tenant.slug, status: tenant.status, adminId: admin.id },
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

    const catalogs = await seedTenantTemplateCatalogs(tenant.id, this.db);
    return {
      tenant: toView(tenant, 1),
      admin,
      ...(generated ? { temporaryPassword: generated } : {}),
      catalogs,
    };
  }

  async update(id: string, input: TenantUpdateInput, actor: Actor): Promise<TenantView> {
    return runWithTenant(null, async () => {
      const previous = await this.db.tenant.findUnique({ where: { id } });
      if (!previous) throw new HttpError(404, "TENANT_NOT_FOUND");
      const updated = await this.db.tenant.update({
        where: { id },
        data: {
          name: input.name,
          status: input.status,
          timezone: input.timezone,
          plan: input.plan,
          employeeLimit: input.employeeLimit,
        },
      });
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
          plan: previous.plan,
          employeeLimit: previous.employeeLimit,
        },
        newState: {
          name: updated.name,
          status: updated.status,
          timezone: updated.timezone,
          plan: updated.plan,
          employeeLimit: updated.employeeLimit,
        },
      });
      const activeUsers = await this.db.user.count({ where: { tenantId: id, active: true } });
      return toView(updated, activeUsers);
    }, true);
  }
}
