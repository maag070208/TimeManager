import Ably from "ably";
import { HttpError } from "@core/middlewares/error.middleware";
import { tenantChannel } from "@core/services/ably";
import { currentTenantId } from "@core/tenancy/context";

/**
 * Emisión de Ably TokenRequests para el navegador (F1C-02). La app key se queda
 * en el servidor: el cliente solo recibe un token de corta vida con capability
 * de suscripción a SU canal, así que no puede publicar ni escuchar a otros
 * usuarios.
 *
 * Con cliente (F1B-05) la web se suscribe al canal con espacio de nombres
 * `tenant:<id>:user:<id>` y el API publica ahí (y en `user:<id>` mientras la web
 * migra), así que la capability incluye AMBOS canales del usuario. Un usuario de
 * plataforma sin cliente solo recibe `user:<id>`.
 */

/** Vida del token: corta; Ably pide uno nuevo con `authCallback` al vencer. */
export const ABLY_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Canal de notificaciones in-app de un usuario (canal histórico). */
export const notificationChannel = (userId: string): string => `user:${userId}`;

/** Canal del usuario dentro del espacio de nombres del cliente (F1B-05). */
export const tenantNotificationChannel = (tenantId: string, userId: string): string =>
  tenantChannel(tenantId, `user:${userId}`);

/**
 * Capability mínima: solo suscribirse a los canales propios, sin publicar.
 * - Con cliente: `tenant:<id>:user:<id>` + `user:<id>` (compatibilidad web).
 * - Plataforma sin cliente: solo `user:<id>`.
 */
export const buildNotificationCapability = (
  userId: string,
  tenantId: string | null = currentTenantId()
): Record<string, ["subscribe"]> => {
  const capability: Record<string, ["subscribe"]> = {
    [notificationChannel(userId)]: ["subscribe"],
  };
  if (tenantId) capability[tenantNotificationChannel(tenantId, userId)] = ["subscribe"];
  return capability;
};

/**
 * Firma en local un TokenRequest (no llama a la red). `apiKey` se pasa explícito
 * para que el builder sea testeable sin depender del entorno; en runtime sale de
 * `env.ABLY_API_KEY`.
 */
export const createNotificationTokenRequest = async (
  userId: string,
  apiKey: string | undefined,
  ttlMs: number = ABLY_TOKEN_TTL_MS,
  tenantId: string | null = currentTenantId()
): Promise<Ably.TokenRequest> => {
  if (!apiKey) throw new HttpError(503, "ABLY_NOT_CONFIGURED");

  try {
    const client = new Ably.Rest({ key: apiKey });
    return await client.auth.createTokenRequest({
      clientId: userId,
      capability: buildNotificationCapability(userId, tenantId),
      ttl: ttlMs,
    });
  } catch {
    throw new HttpError(503, "ABLY_TOKEN_FAILED");
  }
};
