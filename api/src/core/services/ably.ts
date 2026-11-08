import Ably from "ably";
import { env } from "@core/config/env.config";
import { currentTenantId } from "@core/tenancy/context";

let ably: Ably.Rest | null = null;

/**
 * Cliente para publicar desde el servidor. Es REST: publicar no necesita una
 * conexión abierta (una Realtime deja el proceso vivo). Sin app key no hay
 * cliente y los avisos en tiempo real no se mandan; quedan en la campanita.
 */
const getAbly = (): Ably.Rest | null => {
  if (!env.ABLY_API_KEY) return null;
  if (!ably) ably = new Ably.Rest({ key: env.ABLY_API_KEY });
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
  if (!client) return;
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
  if (!client) return;
  await client.channels.get(tenantChannel(tenantId, "broadcast")).publish(eventName, event);
};
