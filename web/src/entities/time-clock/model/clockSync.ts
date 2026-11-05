import { i18n } from "@shared/i18n";

/** Resultado de una baja o alta en un reloj (lo devuelve la API por cada reloj). */
export interface ClockSyncResult {
  serial: string;
  name: string;
  ok: boolean;
  code?: string;
}

/**
 * Mensaje corto para el usuario sobre lo que pasó en cada reloj. Un reloj de solo lectura
 * no es un error: la baja o el alta quedan pendientes ahí y se dice explícitamente.
 */
export const describeClockSync = (results: ClockSyncResult[], action: "baja" | "alta"): string | null => {
  if (results.length === 0) return null;
  return results
    .map((r) => {
      if (r.ok) return i18n.t(`time-clock:clockSync.${action}Done`, { clock: r.name });
      if (r.code === "TIME_CLOCK_READ_ONLY") return i18n.t(`time-clock:clockSync.${action}Pending`, { clock: r.name });
      return i18n.t("time-clock:clockSync.failed", { clock: r.name });
    })
    .join(" · ");
};
