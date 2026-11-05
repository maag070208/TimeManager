import type { TimeClockDevice } from "./types";

/** Estado de la sincronización de un reloj (para su insignia). */
export type TimeClockState = "paused" | "running" | "error" | "ok" | "pending";

export const clockStatus = (clock: TimeClockDevice): TimeClockState => {
  if (clock.pausedByCredentials) return "paused";
  if (clock.inProgress) return "running";
  if (clock.lastRun && !clock.lastRun.ok) return "error";
  return clock.syncedAt ? "ok" : "pending";
};

/** Color de la insignia de cada estado. */
export const CLOCK_STATUS_COLOR: Record<TimeClockState, "success" | "warning" | "danger" | "gray" | "info"> = {
  paused: "danger",
  running: "info",
  // `error` es "Sin conexión" (el último intento no conectó): rojo, no ámbar.
  error: "danger",
  ok: "success",
  pending: "gray",
};
