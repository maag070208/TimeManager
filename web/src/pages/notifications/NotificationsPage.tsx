import { ITButton, ITPage, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { LuBell, LuCheckCheck } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { NotificationItem, useNotificationsList, type NotificationFilter } from "@features/notification/list";
import { FilterPills, type FilterPillItem } from "@shared/ui/filter-pills";
import { LangostinState } from "@shared/ui/langostin";
import { PanelCard } from "@shared/ui/panel-card";
import { formatLongDate } from "@shared/utils/dates";

/** Encabezado del día: "Hoy", "Ayer" o la fecha larga con la primera letra en mayúscula. */
const useDayLabel = () => {
  const { t, i18n } = useTranslation("notifications");
  return (date: Date): string => {
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
    if (diffDays === 0) return t("day.today");
    if (diffDays === 1) return t("day.yesterday");
    const long = formatLongDate(date, i18n.language);
    return long.charAt(0).toUpperCase() + long.slice(1);
  };
};

export default function NotificationsPage() {
  const { t: tt } = useTranslation(["notifications", "common"]);
  const fx = useNotificationsList();
  const dayLabel = useDayLabel();

  const filters: FilterPillItem<NotificationFilter>[] = [
    { id: "all", label: tt("filters.all"), count: fx.counts.all },
    { id: "unread", label: tt("filters.unread"), count: fx.counts.unread },
    { id: "tickets", label: tt("filters.tickets"), count: fx.counts.tickets },
    { id: "people", label: tt("filters.people"), count: fx.counts.people },
    { id: "alerts", label: tt("filters.alerts"), count: fx.counts.alerts },
  ];

  const initialLoad = fx.loading && fx.items.length === 0;
  const empty = !initialLoad && fx.groups.length === 0;

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("title")}
      description={tt("description")}
      icon={<LuBell size={20} />}
      maxWidth="3xl"
      actions={
        fx.unreadCount > 0 ? (
          <ITButton
            variant="outlined"
            color="primary"
            size="lg"
            onClick={fx.handleMarkAll}
          >
            <LuCheckCheck size={14} className="mr-1" />
            {tt("markAllRead")}
          </ITButton>
        ) : undefined
      }
    >
      <ITStack spacing={4}>
        <FilterPills items={filters} value={fx.filter} onChange={fx.setFilter} />

        <PanelCard>
          {initialLoad && <LangostinState kind="loading" />}

          {empty && (
            <LangostinState
              kind={fx.items.length === 0 ? "empty" : "noResults"}
              title={fx.items.length === 0 ? tt("empty") : undefined}
              description={fx.items.length === 0 ? tt("emptyHint") : undefined}
            />
          )}

          {fx.groups.length > 0 && (
            <ul className="m-0 list-none p-0">
              {fx.groups.map((group) => (
                <li key={group.key} className="list-none">
                  <ITText className="m-0 px-1.5 pb-1 pt-3 text-[12px] font-semibold text-slate-500 first:pt-0">
                    {dayLabel(group.date)}
                  </ITText>
                  <ITStack>
                    {group.items.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onSlotClick={fx.handleSlotClick}
                        onDelete={fx.handleDelete}
                      />
                    ))}
                  </ITStack>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </ITStack>
    </ITPage>
  );
}
