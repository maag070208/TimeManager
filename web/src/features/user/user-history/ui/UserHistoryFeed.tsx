import { useMemo, useState, type ReactNode } from "react";
import { ITBentoFeed } from "@axzydev/axzy_ui_system";
import { LuClock, LuUserCheck, LuUserX } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { formatDate } from "@shared/i18n";
import { formatTimeInTZ } from "@shared/utils/dates";
import { FilterPills, type FilterPillItem } from "@shared/ui/filter-pills";
import { TicState } from "@shared/ui/tic";
import { FAMILY_LABEL_KEY, HISTORY_FAMILIES, dayKey, familyOf, historyStats } from "../model/history";
import type { HistoryEntry, HistoryFamily, HistoryFamilyKey } from "../model/types";

/** Ícono de línea por tipo de evento (el API manda el `type`, no el ícono). */
const TYPE_ICON: Record<string, ReactNode> = {
  USER_DEACTIVATED: <LuUserX size={13} />,
  USER_REACTIVATED: <LuUserCheck size={13} />,
};

/** Tono del cuadro del ícono: el kit solo ofrece estos tres en el feed. */
const TONE_BY_FAMILY: Record<HistoryFamilyKey, "success" | "violet" | "neutral"> = {
  account: "neutral",
  other: "neutral",
};

interface FeedGroup {
  key: string;
  label: string;
  items: { id: string; icon: ReactNode; title: string; meta: string; tone: "success" | "violet" | "neutral" }[];
}

interface Props {
  history: HistoryEntry[];
}

/**
 * Historial de la cuenta como feed agrupado por día (plantilla P9): píldoras por
 * familia de evento cuando hay más de una, filas con el cuadro del tipo y los
 * estados vacíos de Tic.
 */
export default function UserHistoryFeed({ history }: Props) {
  const { t } = useTranslation("users");
  const [family, setFamily] = useState<HistoryFamily>("all");

  const stats = useMemo(() => historyStats(history), [history]);

  // Al cambiar de cuenta el filtro puede apuntar a una familia que ya no tiene
  // eventos: se cae a "todo" en vez de dejar el feed vacío sin píldora activa.
  const activeFamily: HistoryFamily =
    family !== "all" && stats.counts[family] === 0 ? "all" : family;

  const filterItems: FilterPillItem<HistoryFamily>[] = [
    { id: "all", label: t("history.family.all"), count: stats.sorted.length },
    ...HISTORY_FAMILIES.filter((key) => stats.counts[key] > 0).map((key) => ({
      id: key,
      label: t(FAMILY_LABEL_KEY[key]),
      count: stats.counts[key],
    })),
  ];

  const shown =
    activeFamily === "all" ? stats.sorted : stats.sorted.filter((entry) => familyOf(entry.type) === activeFamily);
  const todayKey = dayKey(new Date().toISOString());
  const yesterdayKey = dayKey(new Date(Date.now() - 86_400_000).toISOString());

  const groups: FeedGroup[] = [];
  for (const entry of shown) {
    const key = dayKey(entry.timestamp);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label =
        key === todayKey ? t("history.today") : key === yesterdayKey ? t("history.yesterday") : formatDate(entry.timestamp);
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push({
      id: entry.id,
      icon: TYPE_ICON[entry.type] ?? <LuClock size={13} />,
      title: entry.title,
      meta: [formatTimeInTZ(entry.timestamp), entry.detail].filter(Boolean).join(" · "),
      tone: TONE_BY_FAMILY[familyOf(entry.type)],
    });
  }

  return (
    <div className={`mt-2 flex min-h-0 flex-1 flex-col gap-2.5 ${groups.length === 0 ? "justify-center" : ""}`}>
      {filterItems.length > 2 && <FilterPills items={filterItems} value={activeFamily} onChange={setFamily} />}

      {groups.length === 0 ? (
        <TicState
          kind={history.length === 0 ? "empty" : "noResults"}
          size="sm"
          title={history.length === 0 ? t("history.empty") : t("history.noResults")}
          description={history.length === 0 ? t("history.emptyHint") : t("history.noResultsHint")}
        />
      ) : (
        <ITBentoFeed groups={groups} maxHeight={430} />
      )}
    </div>
  );
}
