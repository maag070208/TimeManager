export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  detail?: string | null;
  read: boolean;
  createdAt: string;
}
/** Pantalla que abre una notificación según su tipo; `null` = solo la bandeja. */
export const notificationRoute = (n: Partial<Pick<Notification, "type">>): string | null => {
  if (n.type === "TIME_CLOCK_ROSTER") return "/hr/time-clock/roster";
  return null;
};
