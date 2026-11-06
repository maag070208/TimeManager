import { ITButton, ITCard, ITPage, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { LuBell, LuCheckCheck, LuCircleAlert, LuMail, LuUsers } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { NotificationItem, useNotificationsList, type NotificationFilter } from "@features/notification/list";
import { BentoFilterCards, type BentoFilterItem } from "@shared/ui/bento-filter-cards";
import { TicState } from "@shared/ui/tic";
import { PanelCard } from "@shared/ui/panel-card";
import { formatLongDate } from "@shared/utils/dates";
import { ContentSkeleton } from "@shared/ui/content-skeleton";

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

  const filters: BentoFilterItem[] = [
    { id: "all", label: tt("filters.all"), value: fx.counts.all, icon: <LuBell size={14} /> },
    { id: "unread", label: tt("filters.unread"), value: fx.counts.unread, icon: <LuMail size={14} /> },
    { id: "people", label: tt("filters.people"), value: fx.counts.people, icon: <LuUsers size={14} /> },
    { id: "alerts", label: tt("filters.alerts"), value: fx.counts.alerts, icon: <LuCircleAlert size={14} /> },
  ];

  const initialLoad = fx.loading && fx.items.length === 0;
  const empty = !initialLoad && fx.groups.length === 0;

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title={tt("title")}
      description={tt("description")}
      icon={<LuBell size={20} />}
      actions={
        fx.unreadCount > 0 ? (
          <ITButton variant="outlined" color="primary" onClick={fx.handleMarkAll}>
            <LuCheckCheck size={14} className="mr-1" />
            {tt("markAllRead")}
          </ITButton>
        ) : undefined
      }
    >
      <div className="grid items-start gap-4 pb-12 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <BentoFilterCards
            items={filters}
            activeId={fx.filter}
            onSelect={(id) => fx.setFilter(id as NotificationFilter)}
          />

          <PanelCard>
            {initialLoad && <ContentSkeleton />}

            {empty && (
              <TicState
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
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-4">
          <ITCard contentClassName="!p-0">
            <div className="tm-hero-card rounded-2xl px-5 py-4 text-slate-900">
              <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-slate-500">Resumen</ITText>
              <ITText className="!text-2xl font-extrabold !text-slate-900">{fx.counts.unread} sin leer</ITText>
              <ITText className="!text-[12px] !text-slate-600">de {fx.counts.all} notificaciones</ITText>
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <ITText className="font-bold">Acciones</ITText>
            <ITText muted className="mt-1 block !text-[11.5px]">
              Marca todo como leído o cambia el filtro para revisar solo lo pendiente.
            </ITText>
            {fx.unreadCount > 0 ? (
              <ITButton variant="filled" color="primary" className="mt-3 w-full" onClick={fx.handleMarkAll}>
                <LuCheckCheck size={14} className="mr-1" />
                {tt("markAllRead")}
              </ITButton>
            ) : (
              <ITText muted className="mt-3 block !text-[12px]">Todo al día.</ITText>
            )}
          </ITCard>
        </aside>
      </div>
    </ITPage>
  );
}
