import { prismaClient } from "@core/config/database";
import { currentTenantId } from "@core/tenancy/context";

/**
 * Zona horaria del cliente (F1B-04): `Tenant.timezone`. Toda decisión de "hoy",
 * retardos, tiempo extra y reportes la usa en lugar de la zona del servidor.
 *
 * Caché corta en memoria (la petición la consulta varias veces). Sin contexto
 * de cliente (plataforma/workers globales) devuelve `null` para que el llamador
 * use la precedencia de siempre (`sys_config`/env).
 */
const CACHE_TTL_MS = 60_000;

interface CachedTimezone {
  timezone: string | null;
  at: number;
}

const cache = new Map<string, CachedTimezone>();

const isValidTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Zona IANA del cliente del contexto, o `null` si no hay/invalid. */
export const tenantTimezone = async (): Promise<string | null> => {
  const tenantId = currentTenantId();
  if (!tenantId) return null;
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.timezone;
  let timezone: string | null = null;
  try {
    const tenant = await prismaClient.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    timezone = tenant?.timezone && isValidTimezone(tenant.timezone) ? tenant.timezone : null;
  } catch {
    // BD caída: el llamador cae a la precedencia de siempre.
    return null;
  }
  cache.set(tenantId, { timezone, at: Date.now() });
  return timezone;
};

/** Invalida la caché (al cambiar la zona del cliente en la consola). */
export const forgetTenantTimezone = (tenantId: string): void => {
  cache.delete(tenantId);
};
