import Ably from "ably";
import { env } from "@core/config/env.config";

let ably: Ably.Realtime | null = null;

export const getAbly = (): Ably.Realtime => {
  if (!ably) {
    ably = new Ably.Realtime({ key: env.ABLY_API_KEY });
  }
  return ably;
};

export const broadcastToUser = async (userId: string, event: Record<string, unknown>) => {
  const client = getAbly();
  const channel = client.channels.get(`user:${userId}`);
  await channel.publish("NOTIFICATION", event);
};
