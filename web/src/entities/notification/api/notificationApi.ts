import { api } from "@shared/api/client";
import type { Notification } from "../model/types";

export const notificationsApi = {
  list: (unreadOnly = false) => {
    const qs = unreadOnly ? "?unread=true" : "";
    return api.get<{ data: Notification[]; total: number }>(`/notifications${qs}`);
  },
  unreadCount: () => api.get<{ count: number }>(`/notifications/unread-count`),
  markRead: (id: string) => api.post<void>(`/notifications/${id}/read`),
  markAllRead: () => api.post<void>(`/notifications/read-all`),
  remove: (id: string) => api.delete<void>(`/notifications/${id}`),
};