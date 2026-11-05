import { prismaClient } from "@core/config/database";

export interface TenantBrand {
  name: string;
  slug: string;
  /** Branding F3-05: color de acento, logo (data URL) y remitente propio. */
  brandColor: string | null;
  logoDataUrl: string | null;
  emailFrom: string | null;
}

const cache = new Map<string, { brand: TenantBrand | null; at: number }>();
const TTL_MS = 60_000;

/** Nombre y slug del cliente (correos, enlaces). Cache corto; `tenants` no es tabla de cliente. */
export async function tenantBrand(tenantId: string | null): Promise<TenantBrand | null> {
  if (!tenantId) return null;
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.brand;
  const brand = await prismaClient.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true, brandColor: true, logoDataUrl: true, emailFrom: true },
  });
  cache.set(tenantId, { brand, at: Date.now() });
  return brand;
}

/** Tras renombrar un cliente, para que el siguiente correo ya salga con el nombre nuevo. */
export function forgetTenantBrand(tenantId: string): void {
  cache.delete(tenantId);
}
