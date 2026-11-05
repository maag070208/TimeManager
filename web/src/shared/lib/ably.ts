import { useEffect, useRef } from "react";
import * as Ably from "ably";

/**
 * Key de Ably del entorno (`VITE_ABLY_API_KEY`, en el `.env` de la web fuera
 * de git). Sin key, las notificaciones en vivo se desactivan y la app sigue
 * funcionando: Ably solo empuja avisos a la campanita.
 */
export const ABLY_API_KEY = import.meta.env.VITE_ABLY_API_KEY;

if (!ABLY_API_KEY && import.meta.env.DEV) {
  console.warn(
    "[ably] VITE_ABLY_API_KEY no está configurada: las notificaciones en vivo están desactivadas."
  );
}

let ablyClient: Ably.Realtime | null = null;

const getAblyClient = (): Ably.Realtime | null => {
  if (!ABLY_API_KEY) return null;
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({ key: ABLY_API_KEY });
  }
  return ablyClient;
};

export const useAblyChannel = (
  channelName: string | undefined,
  subscriptions: Record<string, (data: unknown) => void>
) => {
  const handlersRef = useRef(subscriptions);
  handlersRef.current = subscriptions;

  useEffect(() => {
    if (!channelName) return;
    const client = getAblyClient();
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
  }, [channelName]);
};
