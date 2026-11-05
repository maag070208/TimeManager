import { useAblyChannel } from "@shared/lib/ably";
import { store } from "@app/store";
import { prependNotification, type Notification } from "@entities/notification";

/** Lo que publica la API en `user:<id>` (las creadas en lote no traen `id`). */
export type LiveNotification = Partial<Pick<Notification, "id" | "type" | "detail" | "ticketId">> & {
  title?: string;
};

export const useAblyNotifications = (
  userId: string | undefined,
  onNotification?: (notification: LiveNotification) => void
) => {
  useAblyChannel(userId ? `user:${userId}` : undefined, {
    NOTIFICATION: (data: unknown) => {
      store.dispatch(prependNotification(data));
      onNotification?.((data ?? {}) as LiveNotification);
    },
  });
};
