import { useEffect, useRef } from "react";
import * as Ably from "ably";

let ablyClient: Ably.Realtime | null = null;

export const ABLY_API_KEY =
  "yuJ-ow.7iF_wA:tuWolCDo1xBN4tpDEbZFD7A60KNnT_AsTNvhxkII-go";

const getAblyClient = (): Ably.Realtime => {
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