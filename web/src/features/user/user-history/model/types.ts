export interface HistoryEntry {
  id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: string;
  refId?: string;
}

/**
 * Familia de un evento del historial: es lo que filtran las píldoras del feed y
 * lo que separa los mosaicos y la dona. El API devuelve el `type` del evento,
 * no la familia, así que la clasificación vive aquí; un tipo nuevo cae en
 * `other` en vez de perderse.
 */
export type HistoryFamily = "all" | "equipment" | "tickets" | "account" | "other";

/** Familia concreta (sin la píldora "todo"). */
export type HistoryFamilyKey = Exclude<HistoryFamily, "all">;
