import type { PunchChannel } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { currentTenantId } from "@core/tenancy/context";

/**
 * Canales de checada contratados por el cliente (`Tenant.punchChannels`): WEB y
 * APP usan el marcaje remoto; CLOCK usa el reloj físico. La plataforma elige el
 * mix y puede cambiarlo, así que los servicios preguntan por el canal en lugar
 * de asumir que existe el reloj.
 *
 * Caché corta en memoria (60 s): casi toda petición de asistencia, reporte o
 * tablero la necesitan y los canales cambian rara vez. Igual que
 * `tenantCalendar`, el TTL evita consultar el tenant en cada viaje; si se
 * cambian los canales puede tardar hasta un minuto en reflejarse.
 */
const CACHE_TTL_MS = 60_000;

/** Sin contexto de cliente (plataforma/workers) se asume el mix remoto. */
const DEFAULT_CHANNELS: PunchChannel[] = ["WEB", "APP"];

const ALL_CHANNELS: PunchChannel[] = ["WEB", "APP", "CLOCK"];

const cache = new Map<string, { value: PunchChannel[]; at: number }>();

/** Nunca devuelve una lista vacía: el cliente siempre tiene al menos un canal. */
const normalize = (channels: readonly PunchChannel[] | null | undefined): PunchChannel[] => {
  const valid = ALL_CHANNELS.filter((channel) => channels?.includes(channel));
  return valid.length > 0 ? valid : [...DEFAULT_CHANNELS];
};

/**
 * Canales del cliente con caché de 60 s. `db` se inyecta en los servicios que
 * reciben su cliente de BD.
 */
export const tenantPunchChannels = async (
  tenantId: string,
  db: { tenant: { findUnique: (args: never) => Promise<unknown> } } = prismaClient as never
): Promise<PunchChannel[]> => {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const tenant = (await db.tenant.findUnique({
    where: { id: tenantId },
    select: { punchChannels: true },
  } as never)) as { punchChannels: PunchChannel[] } | null;
  const value = normalize(tenant?.punchChannels);
  cache.set(tenantId, { value, at: Date.now() });
  return value;
};

/** Canales del cliente del contexto, o el default si no hay contexto. */
export const currentTenantPunchChannels = async (): Promise<PunchChannel[]> => {
  const tenantId = currentTenantId();
  if (!tenantId) return [...DEFAULT_CHANNELS];
  try {
    return await tenantPunchChannels(tenantId);
  } catch {
    // BD caída: los servicios que dependen solo del mix caen al default.
    return [...DEFAULT_CHANNELS];
  }
};

/** Invalida la caché al cambiar los canales del cliente. */
export const forgetTenantPunchChannels = (tenantId: string): void => {
  cache.delete(tenantId);
};
