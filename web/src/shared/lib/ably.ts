import { useEffect, useRef } from "react";
import * as Ably from "ably";
import { api } from "@shared/api/client";

/**
 * Notificaciones en vivo por Ably (F1C-02). El navegador no recibe la app key:
 * pide al API un TokenRequest firmado con `clientId` propio y capability de
 * suscripción solo sobre `user:<id>`. Sin Ably configurado en el servidor la app
 * sigue funcionando; solo se pierden las notificaciones en vivo (la campanita se
 * actualiza al recargar).
 */
let ablyClient: Ably.Realtime | null = null;
let ablyClientId: string | undefined;
let authUnavailable = false;

const requestTokenRequest = async (): Promise<Ably.TokenRequest> => {
  try {
    return await api.get<Ably.TokenRequest>("/notifications/ably-token");
  } catch (error) {
    if ((error as { status?: number }).status === 503) {
      authUnavailable = true;
      if (import.meta.env.DEV) {
        console.warn(
          "[ably] el API no tiene Ably configurado: notificaciones en vivo desactivadas."
        );
      }
    }
    throw error;
  }
};

const getAblyClient = (clientId?: string): Ably.Realtime | null => {
  if (authUnavailable) return null;
  // Otro usuario con la misma pestaña: el cliente anterior tiene otro clientId.
  if (ablyClient && ablyClientId !== clientId) {
    ablyClient.close();
    ablyClient = null;
  }
  if (!ablyClient) {
    ablyClientId = clientId;
    ablyClient = new Ably.Realtime({
      ...(clientId ? { clientId } : {}),
      authCallback: (_params, callback) => {
        if (authUnavailable) {
          callback("Ably no está configurado: notificaciones en vivo desactivadas", null);
          return;
        }
        void requestTokenRequest().then(
          (tokenRequest) => callback(null, tokenRequest),
          (error: unknown) =>
            callback(error instanceof Error ? error.message : String(error), null)
        );
      },
    });
  }
  return ablyClient;
};

export const useAblyChannel = (
  channelName: string | undefined,
  subscriptions: Record<string, (data: unknown) => void>,
  clientId?: string
) => {
  const handlersRef = useRef(subscriptions);
  handlersRef.current = subscriptions;

  useEffect(() => {
    if (!channelName) return;
    const client = getAblyClient(clientId);
    if (!client) return;
    const channel = client.channels.get(channelName);

    const events = Object.keys(handlersRef.current);
    const listeners = events.map((event) => {
      const listener = (message: Ably.Message) => {
        handlersRef.current[event]?.(message.data);
      };
      channel.subscribe(event, listener);
      return { event, listener };
    });

    return () => {
      listeners.forEach(({ event, listener }) =>
        channel.unsubscribe(event, listener)
      );
    };
  }, [channelName, clientId]);
};
