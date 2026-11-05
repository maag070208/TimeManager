import type { HistoryEntry, HistoryFamilyKey } from "./types";

/**
 * Familia de cada `type` que devuelve `GET /users/:id/history`: el API solo
 * emite eventos de la cuenta (baja/reactivación) desde que el producto dejó
 * atrás los tickets y el inventario del ERP (L-13).
 */
const FAMILY_BY_TYPE: Record<string, HistoryFamilyKey> = {
  USER_DEACTIVATED: "account",
  USER_REACTIVATED: "account",
};

/** Orden estable de las familias (mosaicos, dona y píldoras). */
export const HISTORY_FAMILIES: readonly HistoryFamilyKey[] = ["account", "other"];

/** Llave i18n de cada familia, con el literal tipado para que `t()` lo valide. */
export const FAMILY_LABEL_KEY = {
  account: "history.family.account",
  other: "history.family.other",
} as const satisfies Record<HistoryFamilyKey, string>;

/** Familia de un evento; un tipo desconocido no se pierde, cae en `other`. */
export const familyOf = (type: string): HistoryFamilyKey => FAMILY_BY_TYPE[type] ?? "other";

/** `AAAA-M-D` en hora local: agrupa por día sin correrse de zona. */
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export interface HistoryStats {
  /** Eventos del más reciente al más antiguo. */
  sorted: HistoryEntry[];
  /** Cuántos eventos hay de cada familia. */
  counts: Record<HistoryFamilyKey, number>;
  /** Días distintos con actividad. */
  days: number;
  /** Evento más reciente y más antiguo (extremos del rango real). */
  newest: HistoryEntry | null;
  oldest: HistoryEntry | null;
}

/** Totales del historial que la pantalla pinta (todos salen de los eventos reales). */
export const historyStats = (history: HistoryEntry[]): HistoryStats => {
  const sorted = [...history].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  const counts: Record<HistoryFamilyKey, number> = { account: 0, other: 0 };
  for (const entry of sorted) counts[familyOf(entry.type)] += 1;
  const days = new Set(sorted.map((entry) => dayKey(entry.timestamp))).size;
  return {
    sorted,
    counts,
    days,
    newest: sorted[0] ?? null,
    oldest: sorted[sorted.length - 1] ?? null,
  };
};
