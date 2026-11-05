// API pública de la feature "user-history".
export { default as UserHeaderCard } from "./ui/UserHeaderCard";
export { default as UserHistoryFeed } from "./ui/UserHistoryFeed";
export { useUserHistory } from "./model/useUserHistory";
export { FAMILY_LABEL_KEY, HISTORY_FAMILIES, historyStats } from "./model/history";
export type { HistoryEntry, HistoryFamily, HistoryFamilyKey } from "./model/types";
