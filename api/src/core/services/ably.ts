import Ably from "ably";
import { env } from "@core/config/env.config";
import { currentTenantId } from "@core/tenancy/context";

let ably: Ably.Realtime | null = null;

export const getAbly = (): Ably.Realtime => {
  if (!ably) {
    ably = new Ably.Realtime({ key: env.ABLY_API_KEY });
  }
  return ably;
};

/** Canal de usuario con el prefijo del cliente (F1B-05). */
export const userChannel = (userId: string): string => `user:${userId}`;

/** Canal con espacio de nombres por cliente: `tenant:<id>:<sufijo>`. */
export const tenantChannel = (tenantId: string, suffix: string): string =>
  `tenant:${tenantId}:${suffix}`;

/**
 * Aviso en tiempo real a un usuario. Publica en el canal con espacio de
 * cliente (`tenant:<id>:user:<userId>`) y, mientras la web migra, también en el
 * canal histórico `user:<userId>`. Sin contexto de cliente (plataforma) solo
 * usa el canal histórico.
 */
export const broadcastToUser = async (
  userId: string,
  event: Record<string, unknown>,
  tenantId: string | null = currentTenantId()
) => {
  const client = getAbly();
  const channels = tenantId
    ? [tenantChannel(tenantId, `user:${userId}`), userChannel(userId)]
    : [userChannel(userId)];
  await Promise.all(channels.map((name) => client.channels.get(name).publish("NOTIFICATION", event)));
};

/** Aviso a todos los conectados de un cliente (p. ej. cambios de configuración). */
export const broadcastToTenant = async (
  tenantId: string,
  eventName: string,
  event: Record<string, unknown>
) => {
  const client = getAbly();
  await client.channels.get(tenantChannel(tenantId, "broadcast")).publish(eventName, event);
};
