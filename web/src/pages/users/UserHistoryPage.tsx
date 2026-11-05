import { useMemo, type CSSProperties } from "react";
import { ITBentoDonut, ITBentoGrid, ITBentoTile, ITBentoWaves, ITPage, ITText, ITFlex } from "@axzydev/axzy_ui_system";
import { LuCalendarDays, LuChartPie, LuHistory, LuPackage, LuShieldCheck, LuTicket, LuUserCog, LuUserRound } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FAMILY_LABEL_KEY,
  HISTORY_FAMILIES,
  UserHeaderCard,
  UserHistoryFeed,
  historyStats,
  useUserHistory,
} from "@features/user/user-history";
import { UserPermissionsPanel } from "@features/user/user-permissions";
import { usePermission } from "@entities/user";
import { formatDate } from "@shared/i18n";
import { useGoBack } from "@shared/lib/useGoBack";
import { LangostinState } from "@shared/ui/langostin";
import { InsightNote, Num } from "@shared/ui/bento-bits";
import { PanelCard } from "@shared/ui/panel-card";
import { seriesColor } from "@shared/ui/charts";

/**
 * Historial de una cuenta (plantilla P9): héroe con la identidad y el total de
 * eventos, mosaicos por familia de evento y el feed agrupado por día con
 * píldoras de filtro. Los eventos los da `GET /users/:id/history`; los datos de
 * la persona, `GET /users/:id`. El panel de excepciones de permisos se conserva
 * al pie para quien puede administrarlo.
 */
export default function UserHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation(["users", "common"]);
  const canManagePermissions = usePermission("users.permissions") !== "NONE";

  const { user, history, loading } = useUserHistory(id);
  const stats = useMemo(() => historyStats(history), [history]);
  const { counts } = stats;
  const total = stats.sorted.length;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
  const lastActivity = stats.newest ? formatDate(stats.newest.timestamp) : "";
  const firstActivity = stats.oldest ? formatDate(stats.oldest.timestamp) : "";
  const segments = HISTORY_FAMILIES.filter((key) => counts[key] > 0).map((key) => ({
    label: tt(FAMILY_LABEL_KEY[key]),
    value: counts[key],
    color: seriesColor(HISTORY_FAMILIES.indexOf(key)),
  }));
  // Desglose por tipo exacto de evento, con el título que ya manda el API.
  const typeRows = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>();
    for (const entry of stats.sorted) {
      const row = map.get(entry.type) ?? { title: entry.title, count: 0 };
      row.count += 1;
      map.set(entry.type, row);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [stats.sorted]);

  if (loading) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={tt("history.historyTitle")}
        backAction={() => goBack("/users")}
        icon={<LuHistory size={20} />}
        breadcrumbs={[
          { label: tt("list.breadcrumb"), onClick: () => navigate("/users") },
          { label: tt("history.breadcrumb") },
        ]}
      >
        <LangostinState kind="loading" />
      </ITPage>
    );
  }

  if (!user) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={tt("history.historyTitle")}
        backAction={() => goBack("/users")}
        icon={<LuHistory size={20} />}
        breadcrumbs={[
          { label: tt("list.breadcrumb"), onClick: () => navigate("/users") },
          { label: tt("history.breadcrumb") },
        ]}
      >
        <LangostinState kind="error" title={tt("history.notFound")} description={tt("history.notFoundHint")} />
      </ITPage>
    );
  }

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("history.historyTitle")}
      description={user.name}
      backAction={() => goBack("/users")}
      icon={<LuHistory size={20} />}
      breadcrumbs={[
        { label: tt("list.breadcrumb"), onClick: () => navigate("/users") },
        { label: user.name },
      ]}
    >
      <ITBentoGrid>
        {/* Héroe: identidad de la cuenta y total real de eventos del historial. */}
        <ITBentoTile
          tone="sea"
          cols={6}
          rows={3}
          wide
          icon={<LuUserRound size={15} />}
          label={tt("history.accountLabel")}
          value={<Num value={total} />}
          caption={tt("history.events")}
        >
          <UserHeaderCard user={user} />
        </ITBentoTile>

        <ITBentoTile
          tone={counts.tickets > 0 ? "mint" : "plain"}
          cols={3}
          rows={2}
          icon={<LuTicket size={15} />}
          label={tt(FAMILY_LABEL_KEY.tickets)}
          value={<Num value={counts.tickets} />}
          caption={tt("history.share", { pct: pct(counts.tickets) })}
        >
          {counts.tickets > 0 && <ITBentoWaves level={counts.tickets / total} color="var(--color-success)" />}
        </ITBentoTile>

        <ITBentoTile
          tone={counts.equipment > 0 ? "sun" : "plain"}
          cols={3}
          rows={2}
          icon={<LuPackage size={15} />}
          label={tt(FAMILY_LABEL_KEY.equipment)}
          value={<Num value={counts.equipment} />}
          caption={tt("history.share", { pct: pct(counts.equipment) })}
        >
          {counts.equipment > 0 && <ITBentoWaves level={counts.equipment / total} color="var(--color-warning)" />}
        </ITBentoTile>

        <ITBentoTile
          tone={counts.account > 0 ? "lavender" : "plain"}
          cols={3}
          rows={1}
          icon={<LuUserCog size={15} />}
          label={tt("history.accountChanges")}
          value={<Num value={counts.account} />}
          caption={tt("history.share", { pct: pct(counts.account) })}
        />

        <ITBentoTile
          cols={3}
          rows={1}
          icon={<LuCalendarDays size={15} />}
          label={tt("history.daysWithActivity")}
          value={<Num value={stats.days} />}
          aside={lastActivity ? <ITText as="span" className="text-[11px] tabular-nums opacity-70">{lastActivity}</ITText> : undefined}
        />

        {total === 0 ? (
          <ITBentoTile cols={12} rows={4} wide icon={<LuHistory size={15} />} label={tt("history.activity")}>
            <UserHistoryFeed history={stats.sorted} />
          </ITBentoTile>
        ) : (
          <>
            <ITBentoTile cols={7} rows={6} wide icon={<LuHistory size={15} />} label={tt("history.activity")}>
              <UserHistoryFeed history={stats.sorted} />
            </ITBentoTile>

            <ITBentoTile cols={5} rows={6} wide icon={<LuChartPie size={15} />} label={tt("history.distribution")}>
              <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3">
                <ITFlex align="center" gap={3.5}>
                  <ITFlex className="shrink-0">
                    <ITBentoDonut
                      size={148}
                      segments={segments}
                      center={<Num value={total} />}
                      caption={tt("history.eventsShort")}
                    />
                  </ITFlex>
                  <div className="grid min-w-0 flex-1 gap-2.5">
                    {segments.map((segment) => {
                      const share = pct(segment.value);
                      return (
                        <div key={segment.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 text-[12.5px] font-medium">
                          <ITText as="span" className="truncate">{segment.label}</ITText>
                          <ITText as="span" className="tabular-nums">
                            {segment.value} <ITText as="span" className="opacity-60">{share}%</ITText>
                          </ITText>
                          <div className="it-bento-bar col-span-2">
                            <i style={{ "--it-bento-w": `${share}%`, background: segment.color } as CSSProperties} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ITFlex>

                <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                  <ITText className="m-0 text-[11.5px] font-semibold" style={{ color: "var(--it-bento-muted)" }}>
                    {tt("history.byType")}
                  </ITText>
                  {typeRows.map(([type, row]) => (
                    <div key={type} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <ITText as="span" className="truncate">{row.title}</ITText>
                      <ITText as="span" className="shrink-0 tabular-nums opacity-60">{row.count}</ITText>
                    </div>
                  ))}
                </div>

                <InsightNote icon={<LuCalendarDays size={13} />} className="mt-auto">
                  {firstActivity === lastActivity
                    ? tt("history.insightOneDay", { total, date: lastActivity })
                    : tt("history.insight", { total, from: firstActivity, to: lastActivity })}
                </InsightNote>
              </div>
            </ITBentoTile>
          </>
        )}
      </ITBentoGrid>

      {/* Excepciones de permiso por persona: solo con `users.permissions`. */}
      {canManagePermissions && id && (
        <div className="mt-4">
          <PanelCard
            icon={<LuShieldCheck size={15} />}
            title={tt("form.permissions.title")}
            description={tt("form.permissions.subtitle")}
          >
            <UserPermissionsPanel userId={id} />
          </PanelCard>
        </div>
      )}
    </ITPage>
  );
}
