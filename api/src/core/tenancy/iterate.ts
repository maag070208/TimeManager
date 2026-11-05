import { prismaClient } from "@core/config/database";
import { runWithTenant } from "./context";
import { logger } from "@core/utils/logger";

export interface TenantRef {
  id: string;
  slug: string;
  name: string;
}

/** Clientes ACTIVE, ordenados por slug (corrida estable entre ciclos). */
export async function activeTenants(): Promise<TenantRef[]> {
  // Sin contexto de cliente: la extensión no filtra y ve la tabla completa.
  return prismaClient.tenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });
}

/**
 * Corre `fn` una vez por cliente ACTIVE, cada corrida dentro de su contexto:
 * la extensión de Prisma filtra/inyecta `tenantId` igual que en HTTP. Un
 * cliente que falla no detiene a los demás (el error queda en el log).
 */
export async function forEachActiveTenant(
  fn: (tenant: TenantRef) => Promise<void>
): Promise<void> {
  for (const tenant of await activeTenants()) {
    try {
      await runWithTenant(tenant.id, () => fn(tenant));
    } catch (err) {
      logger.error(
        `[tenancy] corrida del cliente ${tenant.slug} falló: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
