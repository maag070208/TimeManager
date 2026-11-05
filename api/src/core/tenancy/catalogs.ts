import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { runWithTenant } from "./context";
import { logger } from "@core/utils/logger";
import template from "../../../prisma/seed-data/tenant_template_catalogs.json";

interface TemplateCatalogs {
  removalCategories: Array<{ key: string; name: string }>;
  documentTypes: Array<{ name: string; required: boolean; sortOrder: number }>;
}

const TEMPLATE = template as TemplateCatalogs;

/**
 * Catálogos plantilla de un cliente nuevo: motivos de baja (reloj/padrón) y
 * tipos de documento del expediente. Idempotente (insert-missing vía
 * skipDuplicates sobre los únicos compuestos); corre dentro del contexto del
 * cliente, así que la extensión inyecta el tenantId en cada fila.
 */
export async function seedTenantTemplateCatalogs(
  tenantId: string,
  db: PrismaClient = prismaClient
): Promise<{ removalCategories: number; documentTypes: number }> {
  return runWithTenant(tenantId, async () => {
    const removal = await db.removalCategory.createMany({
      data: TEMPLATE.removalCategories.map((c) => ({ key: c.key, name: c.name })),
      skipDuplicates: true,
    });
    const documents = await db.documentType.createMany({
      data: TEMPLATE.documentTypes.map((d) => ({ name: d.name, required: d.required, sortOrder: d.sortOrder })),
      skipDuplicates: true,
    });
    logger.info(
      `[tenancy] catálogos plantilla del cliente ${tenantId}: ${removal.count} motivos de baja, ${documents.count} tipos de documento`
    );
    return { removalCategories: removal.count, documentTypes: documents.count };
  });
}
