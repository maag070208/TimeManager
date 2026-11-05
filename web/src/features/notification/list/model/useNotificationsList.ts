import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { AppDispatch, RootState } from "@app/store";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationRoute,
  notificationsApi,
  type Notification,
} from "@entities/notification";

export type NotificationFilter = "all" | "unread" | "tickets" | "people" | "alerts";

/** Tipos de notificación que pertenecen a cada filtro temático. */
const TYPES_BY_FILTER: Record<"tickets" | "people" | "alerts", readonly string[]> = {
  tickets: ["COMMENT", "ASSIGNED", "TICKET_UPDATED", "TICKET_CREATED"],
  people: ["USER_CREATED", "USER_DEACTIVATED", "EMPLOYEE_DOC_UPLOADED"],
  alerts: ["INVENTORY_AUDIT", "KITCHEN_ALERTS"],
};

const matches = (n: Notification, filter: NotificationFilter): boolean => {
  if (filter === "all") return true;
  if (filter === "unread") return !n.read;
  return TYPES_BY_FILTER[filter].includes(n.type);
};

/** Llave local `AAAA-MM-DD` del día de la notificación (agrupa el feed por día). */
const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface NotificationDayGroup {
  key: string;
  /** Primera notificación del día: de ahí sale la fecha del encabezado. */
  date: Date;
  items: Notification[];
}

export const useNotificationsList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, unreadCount, loading } = useSelector(
    (s: RootState) => s.notifications
  );
  const [filter, setFilter] = useState<NotificationFilter>("all");

  useEffect(() => {
    dispatch(fetchNotifications(false));
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  const handleSlotClick = useCallback(
    (n: Notification) => {
      if (!n.read) dispatch(markNotificationRead(n.id));
      const route = notificationRoute(n);
      if (route) navigate(route);
    },
    [dispatch, navigate]
  );

  const handleMarkAll = useCallback(() => {
    dispatch(markAllNotificationsRead());
  }, [dispatch]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await notificationsApi.remove(id);
      dispatch(fetchNotifications(false));
      dispatch(fetchUnreadCount());
    },
    [dispatch]
  );

  // Conteos por filtro, sobre la lista completa.
  const counts = useMemo<Record<NotificationFilter, number>>(
    () => ({
      all: items.length,
      unread: items.filter((n) => matches(n, "unread")).length,
      tickets: items.filter((n) => matches(n, "tickets")).length,
      people: items.filter((n) => matches(n, "people")).length,
      alerts: items.filter((n) => matches(n, "alerts")).length,
    }),
    [items]
  );

  // Del más nuevo al más viejo, agrupado por día local.
  const groups = useMemo<NotificationDayGroup[]>(() => {
    const sorted = items
      .filter((n) => matches(n, filter))
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const out: NotificationDayGroup[] = [];
    for (const n of sorted) {
      const key = dayKey(n.createdAt);
      let group = out[out.length - 1];
      if (!group || group.key !== key) {
        group = { key, date: new Date(n.createdAt), items: [] };
        out.push(group);
      }
      group.items.push(n);
    }
    return out;
  }, [items, filter]);

  return {
    items,
    unreadCount,
    loading,
    filter,
    setFilter,
    counts,
    groups,
    handleMarkAll,
    handleDelete,
    handleSlotClick,
  };
};

export type UseNotificationsList = ReturnType<typeof useNotificationsList>;
