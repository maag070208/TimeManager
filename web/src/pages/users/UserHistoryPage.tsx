import { useMemo, type CSSProperties } from "react";
import { ITBentoDonut, ITCard, ITText } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { LuCalendarDays, LuChartPie, LuHistory, LuShieldCheck, LuUserCog } from "react-icons/lu";
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
import { TicState } from "@shared/ui/tic";
import { Num } from "@shared/ui/bento-bits";
import { PanelCard } from "@shared/ui/panel-card";
import { seriesColor } from "@shared/ui/charts";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";

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
  const { t: tt } = useTranslation(["users", "common", "employees"]);
  const canManagePermissions = usePermission("users.permissions") !== "NONE";

  const { user, history, loading } = useUserHistory(id);
  const stats = useMemo(() => historyStats(history), [history]);
  const { counts } = stats;
  const total = stats.sorted.length;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
  const lastActivity = stats.newest ? formatDate(stats.newest.timestamp) : "";
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
        backAction={() => goBack("/employees")}
        icon={<LuHistory size={20} />}
        breadcrumbs={[
          { label: tt("employees:breadcrumb"), onClick: () => navigate("/employees") },
          { label: tt("history.breadcrumb") },
        ]}
        loading
      >
        {null}
      </ITPage>
    );
  }

  if (!user) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={tt("history.historyTitle")}
        backAction={() => goBack("/employees")}
        icon={<LuHistory size={20} />}
        breadcrumbs={[
          { label: tt("employees:breadcrumb"), onClick: () => navigate("/employees") },
          { label: tt("history.breadcrumb") },
        ]}
      >
        <TicState kind="error" title={tt("history.notFound")} description={tt("history.notFoundHint")} />
      </ITPage>
    );
  }

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("history.historyTitle")}
      description={user.name}
      backAction={() => goBack("/employees")}
      icon={<LuHistory size={20} />}
      breadcrumbs={[
        { label: tt("employees:breadcrumb"), onClick: () => navigate("/employees") },
        { label: user.name },
      ]}
    >
      <div className="flex flex-col gap-4">
        <ITCard contentClassName="!p-0">
          <div className="tm-hero-card rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <ITText className="!text-[10.5px] font-semibold uppercase tracking-[0.10em] text-slate-500">Historial de la cuenta</ITText>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-[30px] font-black leading-none text-slate-900"><Num value={total} /></span>
                  <span className="pb-1 text-[12px] text-slate-600">{tt("history.events")}</span>
                </div>
              </div>
              {lastActivity && <span className="rounded-full bg-white/70 px-3 py-1 text-[11.5px] font-semibold text-slate-600">Última actividad: {lastActivity}</span>}
            </div>
            <div className="mt-3 rounded-xl bg-white/70 p-3">
              <UserHeaderCard user={user} />
            </div>
          </div>
        </ITCard>

        <BentoKpiGrid
          items={[
            { id: "account", label: tt("history.accountChanges"), value: <Num value={counts.account} />, caption: tt("history.share", { pct: pct(counts.account) }), icon: <LuUserCog size={14} />, tone: "info" },
            { id: "days", label: tt("history.daysWithActivity"), value: <Num value={stats.days} />, caption: lastActivity ? `Última: ${lastActivity}` : "Sin actividad", icon: <LuCalendarDays size={14} />, tone: "neutral" },
          ]}
        />

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <PanelCard className="lg:col-span-7" icon={<LuHistory size={16} />} title={tt("history.activity")}>
            <UserHistoryFeed history={stats.sorted} />
          </PanelCard>

          <PanelCard className="lg:col-span-5" icon={<LuChartPie size={16} />} title={tt("history.distribution")}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center">
                <ITBentoDonut size={148} segments={segments} center={<Num value={total} />} caption={tt("history.eventsShort")} />
              </div>
              <div className="grid gap-2">
                {segments.map((segment) => {
                  const share = pct(segment.value);
                  return (
                    <div key={segment.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 text-[12.5px] font-medium">
                      <ITText as="span" className="truncate">{segment.label}</ITText>
                      <ITText as="span" className="tabular-nums">{segment.value} <ITText as="span" className="opacity-60">{share}%</ITText></ITText>
                      <div className="it-bento-bar col-span-2"><i style={{ "--it-bento-w": `${share}%`, background: segment.color } as CSSProperties} /></div>
                    </div>
                  );
                })}
              </div>
              {typeRows.length > 0 && (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto border-t border-slate-100 pt-2">
                  <ITText className="!text-[11.5px] font-semibold text-slate-500">{tt("history.byType")}</ITText>
                  {typeRows.map(([type, row]) => (
                    <div key={type} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <ITText as="span" className="truncate">{row.title}</ITText>
                      <ITText as="span" className="shrink-0 tabular-nums text-slate-500">{row.count}</ITText>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PanelCard>
        </div>
      </div>

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
