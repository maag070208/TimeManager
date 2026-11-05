import type { HistoryEntry, HistoryFamilyKey } from "./types";

/**
 * Familia de cada `type` que devuelve `GET /users/:id/history`:
 * `LOAN_CUSTODIAN`/`MOVEMENT` son inventario, los `TICKET_*` son tickets y
 * `USER_DEACTIVATED`/`USER_REACTIVATED` son cambios de la cuenta.
 */
const FAMILY_BY_TYPE: Record<string, HistoryFamilyKey> = {
  LOAN_CUSTODIAN: "equipment",
  MOVEMENT: "equipment",
  TICKET_CREATED: "tickets",
  TICKET_ASSIGNED: "tickets",
  TICKET_COMMENT: "tickets",
  USER_DEACTIVATED: "account",
  USER_REACTIVATED: "account",
};

/** Orden estable de las familias (mosaicos, dona y píldoras). */
export const HISTORY_FAMILIES: readonly HistoryFamilyKey[] = ["equipment", "tickets", "account", "other"];

/** Llave i18n de cada familia, con el literal tipado para que `t()` lo valide. */
export const FAMILY_LABEL_KEY = {
  equipment: "history.family.equipment",
  tickets: "history.family.tickets",
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
  const counts: Record<HistoryFamilyKey, number> = { equipment: 0, tickets: 0, account: 0, other: 0 };
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

/** ¿El evento se puede abrir en su pantalla de detalle? */
export const historyHref = (entry: HistoryEntry, can: { tickets: boolean; loans: boolean }): string | undefined => {
  if (!entry.refId) return undefined;
  if (familyOf(entry.type) === "tickets") return can.tickets ? `/tickets/${entry.refId}` : undefined;
  if (entry.type === "LOAN_CUSTODIAN") return can.loans ? `/inventory/loans/${entry.refId}` : undefined;
  return undefined;
};
