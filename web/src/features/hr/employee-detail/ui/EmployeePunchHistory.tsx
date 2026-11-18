import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  LuChevronDown,
  LuCoffee,
  LuFingerprint,
  LuHistory,
  LuLogIn,
  LuLogOut,
  LuMapPin,
  LuUtensils,
} from "react-icons/lu";
import { ITBadget, ITEmptyState, ITText } from "@axzydev/axzy_ui_system";
import { personalApi, type PunchHistoryEntry } from "@entities/hr";
import { useTenantTimezone } from "@entities/user";
import { PanelCard } from "@shared/ui/panel-card";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { LocationMap } from "@shared/ui/location-map";
import { dateKeyInTimeZone, formatDateTime, formatTimeInTZ } from "@shared/utils/dates";
import { i18n } from "@shared/i18n";
import { errorMessage } from "@shared/api/errors";

const RANGES = [7, 14, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

const TYPE_STYLE: Record<string, { icon: ReactNode; chip: string }> = {
  ENTRY: { icon: <LuLogIn size={16} />, chip: "bg-emerald-50 text-emerald-700" },
  LUNCH_START: { icon: <LuUtensils size={16} />, chip: "bg-amber-50 text-amber-700" },
  LUNCH_END: { icon: <LuCoffee size={16} />, chip: "bg-sky-50 text-sky-700" },
  EXIT: { icon: <LuLogOut size={16} />, chip: "bg-slate-100 text-slate-700" },
  CLOCK: { icon: <LuFingerprint size={16} />, chip: "bg-violet-50 text-violet-700" },
};

const ADJUSTMENT_COLOR = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

const shiftKey = (key: string, days: number): string => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <span className="block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
    <span className="block text-[13px] font-semibold text-slate-900">{children}</span>
  </div>
);

/** Historial detallado de checadas de la persona: reloj, web y app, día por día. */
export default function EmployeePunchHistory({ userId }: { userId: string }) {
  const { t } = useTranslation("employees");
  const h = (key: string, vars?: Record<string, unknown>) => t(`detail.activity.history.${key}` as never, vars as never) as unknown as string;
  const timezone = useTenantTimezone();
  const [days, setDays] = useState<RangeDays>(14);
  const [punches, setPunches] = useState<PunchHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const to = dateKeyInTimeZone(new Date(), timezone);
    const from = shiftKey(to, -(days - 1));
    setPunches(null);
    setError(null);
    personalApi
      .punchHistory(userId, { from, to })
      .then((res) => !cancelled && setPunches(res.punches))
      .catch((e: unknown) => !cancelled && setError(errorMessage(e, t("detail.activity.history.error" as never))));
    return () => {
      cancelled = true;
    };
  }, [userId, days, timezone, t]);

  const byDay = useMemo(() => {
    const groups = new Map<string, PunchHistoryEntry[]>();
    for (const punch of punches ?? []) {
      const key = dateKeyInTimeZone(new Date(punch.occurredAt), timezone);
      groups.set(key, [...(groups.get(key) ?? []), punch]);
    }
    return [...groups.entries()];
  }, [punches, timezone]);

  const time = (iso: string) => formatTimeInTZ(iso, timezone);
  const dayLabel = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const typeKey = (punch: PunchHistoryEntry) => punch.type ?? "CLOCK";
  const sourceLabel = (punch: PunchHistoryEntry) =>
    punch.source === "CLOCK"
      ? `${t("detail.activity.source.CLOCK")} · ${t(`detail.activity.method.${punch.method ?? "OTHER"}` as never)}`
      : t(`detail.activity.source.${punch.source}` as never);

  return (
    <PanelCard
      className="tm-hero-card tm-hero-card--lavender"
      icon={<LuHistory size={15} />}
      title={h("title")}
      actions={
        <div className="flex flex-wrap gap-1">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition ${
                days === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {h(`ranges.${value}`)}
            </button>
          ))}
        </div>
      }
    >
      <ITText className="mb-3 block !text-[12px] text-slate-500">
        {h("subtitle")}
        {punches && ` · ${h("count", { count: punches.length })}`}
      </ITText>

      {error ? (
        <ITText className="block rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[12.5px] text-red-700">{error}</ITText>
      ) : !punches ? (
        <ContentSkeleton />
      ) : punches.length === 0 ? (
        <ITEmptyState icon={<LuFingerprint size={18} />} title={h("empty")} className="!py-6" />
      ) : (
        <div className="flex flex-col gap-4 pb-8">
          {byDay.map(([day, rows]) => (
            <section key={day}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <ITText className="!text-[13px] font-extrabold capitalize text-slate-900">{dayLabel(day)}</ITText>
                <ITText className="!text-[11.5px] text-slate-500">
                  {h("firstLast", { first: time(rows[rows.length - 1].occurredAt), last: time(rows[0].occurredAt) })} ·{" "}
                  {h("count", { count: rows.length })}
                </ITText>
              </div>
              <ul className="flex flex-col gap-1.5">
                {rows.map((punch) => {
                  const style = TYPE_STYLE[typeKey(punch)];
                  const open = openId === punch.id;
                  const latest = punch.adjustments[0];
                  const deviceDiff = punch.clientReportedAt
                    ? Math.round(Math.abs(Date.parse(punch.occurredAt) - Date.parse(punch.clientReportedAt)) / 60_000)
                    : 0;
                  return (
                    <li key={punch.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white/90">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : punch.id)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>{style.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-bold text-slate-900">{h(`type.${typeKey(punch)}`)}</span>
                          <span className="flex flex-wrap items-center gap-1 pt-0.5">
                            <ITBadget color="info" size="sm">{sourceLabel(punch)}</ITBadget>
                            {punch.workMode && <ITBadget color="gray" size="sm">{h(`workMode.${punch.workMode}`)}</ITBadget>}
                            {punch.location && (
                              <ITBadget color="success" size="sm">
                                <span className="inline-flex items-center gap-1"><LuMapPin size={10} /> {h("withLocation")}</span>
                              </ITBadget>
                            )}
                            {latest && (
                              <ITBadget color={ADJUSTMENT_COLOR[latest.status as keyof typeof ADJUSTMENT_COLOR] ?? "gray"} size="sm">
                                {h(`adjustment.${latest.status}`)}
                              </ITBadget>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-[18px] font-black tabular-nums text-slate-900">{time(punch.occurredAt)}</span>
                        <LuChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                      </button>

                      {open && (
                        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <Detail label={h("details.serverTime")}>{formatDateTime(punch.occurredAt)}</Detail>
                            {punch.clientReportedAt && (
                              <Detail label={h("details.deviceTime")}>
                                {time(punch.clientReportedAt)}
                                {deviceDiff > 0 && <span className="ml-1 text-[11.5px] font-medium text-amber-600">({h("details.deviceDiff", { minutes: deviceDiff })})</span>}
                              </Detail>
                            )}
                            <Detail label={h("details.received")}>{formatDateTime(punch.receivedAt)}</Detail>
                            <Detail label={h("details.source")}>{sourceLabel(punch)}</Detail>
                            {punch.clock && <Detail label={h("details.clock")}>{punch.clock}</Detail>}
                            {punch.workMode && <Detail label={h("details.workMode")}>{h(`workMode.${punch.workMode}`)}</Detail>}
                            {punch.source !== "CLOCK" && (
                              <Detail label={h("details.location")}>
                                {punch.location ? (
                                  <>
                                    {punch.location.latitude.toFixed(5)}, {punch.location.longitude.toFixed(5)}
                                    {punch.location.gpsAccuracyMeters != null && (
                                      <span className="block text-[11.5px] font-medium text-slate-500">
                                        {h("details.accuracy", { meters: Math.round(punch.location.gpsAccuracyMeters) })}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-500">{h("details.noLocation")}</span>
                                )}
                              </Detail>
                            )}
                          </div>

                          {punch.note && (
                            <div className="mt-3">
                              <Detail label={h("details.note")}>{punch.note}</Detail>
                            </div>
                          )}

                          {punch.location && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => setMapId(mapId === punch.id ? null : punch.id)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-slate-700 shadow-sm transition hover:shadow"
                              >
                                <LuMapPin size={12} /> {mapId === punch.id ? h("details.hideMap") : h("details.showMap")}
                              </button>
                              {mapId === punch.id && (
                                <div className="mt-2">
                                  <LocationMap
                                    latitude={punch.location.latitude}
                                    longitude={punch.location.longitude}
                                    height={260}
                                    caption={h("details.mapCaption")}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {punch.adjustments.length > 0 && (
                            <div className="mt-3">
                              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">{h("details.adjustments")}</span>
                              <ul className="mt-1 flex flex-col gap-1.5">
                                {punch.adjustments.map((adjustment) => (
                                  <li key={adjustment.id} className="rounded-lg bg-white px-3 py-2 text-[12.5px]">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                      <ITBadget color={ADJUSTMENT_COLOR[adjustment.status as keyof typeof ADJUSTMENT_COLOR] ?? "gray"} size="sm">
                                        {h(`adjustment.${adjustment.status}`)}
                                      </ITBadget>
                                      <span className="text-slate-500">{formatDateTime(adjustment.createdAt)}</span>
                                      {adjustment.proposedAt && (
                                        <span className="font-semibold text-slate-700">{h("details.proposed", { time: time(adjustment.proposedAt) })}</span>
                                      )}
                                    </span>
                                    <span className="mt-1 block text-slate-700">{adjustment.reason}</span>
                                    {adjustment.decisionNote && <span className="block text-slate-500">{adjustment.decisionNote}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
