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

/** Calendario del cliente: zona (válida) y primer día de la semana laboral. */
export interface TenantCalendar {
  timezone: string | null;
  weekStartDay: number | null;
}

const cache = new Map<string, { value: TenantCalendar; at: number }>();

const isValidTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/**
 * Zona y semana del cliente con caché de 60 s: casi toda petición de asistencia,
 * jornada o reportes las necesita, y cambian rara vez. `db` se inyecta en los
 * servicios que reciben su cliente de BD.
 */
export const tenantCalendar = async (
  tenantId: string,
  db: { tenant: { findUnique: (args: never) => Promise<unknown> } } = prismaClient as never
): Promise<TenantCalendar> => {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const tenant = (await db.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true, weekStartDay: true },
  } as never)) as { timezone: string | null; weekStartDay: number | null } | null;
  const value: TenantCalendar = {
    timezone: tenant?.timezone && isValidTimezone(tenant.timezone) ? tenant.timezone : null,
    weekStartDay: tenant?.weekStartDay ?? null,
  };
  cache.set(tenantId, { value, at: Date.now() });
  return value;
};

/** Zona IANA del cliente del contexto, o `null` si no hay/invalid. */
export const tenantTimezone = async (): Promise<string | null> => {
  const tenantId = currentTenantId();
  if (!tenantId) return null;
  try {
    return (await tenantCalendar(tenantId)).timezone;
  } catch {
    // BD caída: el llamador cae a la precedencia de siempre.
    return null;
  }
};

/** Invalida la caché al cambiar la zona o la semana del cliente. */
export const forgetTenantTimezone = (tenantId: string): void => {
  cache.delete(tenantId);
};
