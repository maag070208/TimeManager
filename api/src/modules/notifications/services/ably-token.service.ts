import Ably from "ably";
import { HttpError } from "@core/middlewares/error.middleware";

/**
 * Emisión de Ably TokenRequests para el navegador (F1C-02). La app key se queda
 * en el servidor: el cliente solo recibe un token de corta vida con capability
 * de suscripción a SU canal (`user:<id>`), así que no puede publicar ni escuchar
 * a otros usuarios.
 */

/** Vida del token: corta; Ably pide uno nuevo con `authCallback` al vencer. */
export const ABLY_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Canal de notificaciones in-app de un usuario (el único que publica la API). */
export const notificationChannel = (userId: string): string => `user:${userId}`;

/** Capability mínima: solo suscribirse al canal propio, sin publicar. */
export const buildNotificationCapability = (
  userId: string
): Record<string, ["subscribe"]> => ({
  [notificationChannel(userId)]: ["subscribe"],
});

/**
 * Firma en local un TokenRequest (no llama a la red). `apiKey` se pasa explícito
 * para que el builder sea testeable sin depender del entorno; en runtime sale de
 * `env.ABLY_API_KEY`.
 */
export const createNotificationTokenRequest = async (
  userId: string,
  apiKey: string | undefined,
  ttlMs: number = ABLY_TOKEN_TTL_MS
): Promise<Ably.TokenRequest> => {
  if (!apiKey) throw new HttpError(503, "ABLY_NOT_CONFIGURED");

  try {
    const client = new Ably.Rest({ key: apiKey });
    return await client.auth.createTokenRequest({
      clientId: userId,
      capability: buildNotificationCapability(userId),
      ttl: ttlMs,
    });
  } catch {
    throw new HttpError(503, "ABLY_TOKEN_FAILED");
  }
};
