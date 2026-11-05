import { useMemo, useState, type ReactNode } from "react";
import { ITBentoFeed } from "@axzydev/axzy_ui_system";
import {
  LuArrowLeftRight,
  LuClipboardCheck,
  LuClock,
  LuMessageSquare,
  LuTicket,
  LuUserCheck,
  LuUserPlus,
  LuUserX,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import { formatDate } from "@shared/i18n";
import { formatTimeInTZ } from "@shared/utils/dates";
import { FilterPills, type FilterPillItem } from "@shared/ui/filter-pills";
import { LangostinState } from "@shared/ui/langostin";
import {
  FAMILY_LABEL_KEY,
  HISTORY_FAMILIES,
  dayKey,
  familyOf,
  historyHref,
  historyStats,
} from "../model/history";
import type { HistoryEntry, HistoryFamily, HistoryFamilyKey } from "../model/types";

/** Ícono de línea por tipo de evento (el API manda el `type`, no el ícono). */
const TYPE_ICON: Record<string, ReactNode> = {
  LOAN_CUSTODIAN: <LuClipboardCheck size={13} />,
  MOVEMENT: <LuArrowLeftRight size={13} />,
  TICKET_CREATED: <LuTicket size={13} />,
  TICKET_ASSIGNED: <LuUserPlus size={13} />,
  TICKET_COMMENT: <LuMessageSquare size={13} />,
  USER_DEACTIVATED: <LuUserX size={13} />,
  USER_REACTIVATED: <LuUserCheck size={13} />,
};

/** Tono del cuadro del ícono: el kit solo ofrece estos tres en el feed. */
const TONE_BY_FAMILY: Record<HistoryFamilyKey, "success" | "violet" | "neutral"> = {
  equipment: "success",
  tickets: "violet",
  account: "neutral",
  other: "neutral",
};

interface FeedGroup {
  key: string;
  label: string;
  items: { id: string; icon: ReactNode; title: string; meta: string; tone: "success" | "violet" | "neutral"; href?: string }[];
}

interface Props {
  history: HistoryEntry[];
}

/**
 * Historial de la cuenta como feed agrupado por día (plantilla P9): píldoras por
 * familia de evento cuando hay más de una, filas con el cuadro del tipo y los
 * estados vacíos de Langostín. Los tickets y los préstamos abren su detalle
 * cuando la sesión tiene el permiso de esa pantalla.
 */
export default function UserHistoryFeed({ history }: Props) {
  const { t } = useTranslation("users");
  const navigate = useNavigate();
  const canViewTickets = useCan("tickets.view");
  const canViewLoans = useCan("loans.view");
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
      href: historyHref(entry, { tickets: canViewTickets, loans: canViewLoans }),
    });
  }

  const handleItemClick = (item: { href?: string }) => {
    if (item.href) navigate(item.href);
  };

  return (
    <div className={`mt-2 flex min-h-0 flex-1 flex-col gap-2.5 ${groups.length === 0 ? "justify-center" : ""}`}>
      {filterItems.length > 2 && <FilterPills items={filterItems} value={activeFamily} onChange={setFamily} />}

      {groups.length === 0 ? (
        <LangostinState
          kind={history.length === 0 ? "empty" : "noResults"}
          size="sm"
          title={history.length === 0 ? t("history.empty") : t("history.noResults")}
          description={history.length === 0 ? t("history.emptyHint") : t("history.noResultsHint")}
        />
      ) : (
        <ITBentoFeed groups={groups} maxHeight={430} onItemClick={handleItemClick} />
      )}
    </div>
  );
}
