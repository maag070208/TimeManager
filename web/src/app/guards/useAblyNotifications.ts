import { useAblyChannel } from "@shared/lib/ably";
import { store } from "@app/store";
import { prependNotification, type Notification } from "@entities/notification";

/** Lo que publica la API en el canal del usuario (las creadas en lote no traen `id`). */
export type LiveNotification = Partial<Pick<Notification, "id" | "type" | "detail">> & {
  title?: string;
};

/**
 * Canal de avisos del usuario (F1B-05): con cliente, el backend publica en
 * `tenant:<tenantId>:user:<userId>`; el personal de plataforma sin cliente sigue
 * en el canal histórico `user:<id>`. Durante la transición el API publica en
 * ambos, pero la web solo escucha el que le toca.
 */
export const userNotificationChannel = (
  userId: string | undefined,
  tenantId: string | null | undefined
): string | undefined => {
  if (!userId) return undefined;
  return tenantId ? `tenant:${tenantId}:user:${userId}` : `user:${userId}`;
};

export const useAblyNotifications = (
  userId: string | undefined,
  tenantId: string | null | undefined,
  onNotification?: (notification: LiveNotification) => void
) => {
  useAblyChannel(
    userNotificationChannel(userId, tenantId),
    {
      NOTIFICATION: (data: unknown) => {
        store.dispatch(prependNotification(data));
        onNotification?.((data ?? {}) as LiveNotification);
      },
    },
    userId
  );
};
