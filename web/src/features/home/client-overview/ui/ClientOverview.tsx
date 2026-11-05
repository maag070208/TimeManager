import type { ReactNode } from "react";
import { ITBentoStatStrip, ITButton, ITText } from "@axzydev/axzy_ui_system";
import { useCan } from "@entities/user";
import { LuCalendarClock, LuCircleCheck, LuCircle, LuClock3, LuFolderOpen, LuSettings2, LuUsersRound } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dyn } from "@shared/i18n";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { PanelCard } from "@shared/ui/panel-card";
import { TicState } from "@shared/ui/tic";
import { useClientOverview } from "../model/useClientOverview";

const hours = (min: number) => (min / 60).toFixed(1).replace(/\.0$/, "");

/** Bloque del inicio: esqueleto mientras carga, aviso si falla. */
function Block<T>({ value, children }: { value: T | null | undefined; children: (v: T) => ReactNode }) {
  const { t } = useTranslation("home");
  if (value === undefined) return <ContentSkeleton size="sm" />;
  if (value === null) return <TicState kind="error" size="sm" description={t("client.loadError")} />;
  return <>{children(value)}</>;
}

export default function ClientOverview() {
  const { t, i18n } = useTranslation("home");
  const tr = dyn(t);
  const navigate = useNavigate();
  const fx = useClientOverview();
  // El bloque de asistencia lo ve quien tiene `attendance.view` (p. ej. el
  // empleado, con alcance OWN), pero `/hr/time-clock` exige `time_clock.view`.
  // Sin ese permiso el "Ver todo" lleva al portal del trabajador (`/mi-jornada`),
  // que es su vista de marcajes, en vez de rebotar a `/` (botón muerto).
  const canTimeClockView = useCan("time_clock.view");
  const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });

  if (!fx.hasAny) {
    return (
      <PanelCard>
        <TicState kind="empty" title={t("client.nothing.title")} description={t("client.nothing.description")} />
      </PanelCard>
    );
  }

  // Pasos del onboarding cuyo destino exige `time_clock.view`: sin permiso se
  // omiten para que "Ir" no rebote a `/` (mismo criterio que el "Ver todo").
  const onboardingSteps = fx.onboarding?.filter((step) => step.id !== "clock" || canTimeClockView) ?? null;
  const pendingSteps = onboardingSteps?.filter((s) => !s.done).length ?? 0;
  const seeAll = (to: string) => (
    <ITButton variant="text" color="primary" size="sm" onClick={() => navigate(to)}>
      {t("client.seeAll")}
    </ITButton>
  );

  return (
    <div className="flex flex-col gap-4">
      {onboardingSteps && pendingSteps > 0 && (
        <PanelCard icon={<LuCircleCheck />} title={t("client.onboarding.title")} description={t("client.onboarding.description")}>
          <ol className="grid gap-2 sm:grid-cols-2">
            {onboardingSteps.map((step, i) => (
              <li key={step.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
                {step.done ? (
                  <LuCircleCheck aria-hidden size={20} className="shrink-0 text-[var(--color-success)]" />
                ) : (
                  <LuCircle aria-hidden size={20} className="shrink-0 text-slate-300" />
                )}
                <div className="min-w-0 flex-1">
                  <ITText className={`block text-sm font-semibold ${step.done ? "text-slate-400 line-through" : ""}`}>
                    {i + 1}. {tr(`client.onboarding.${step.id}`)}
                  </ITText>
                  {!step.done && (
                    <ITText className="block text-xs text-slate-500">{tr(`client.onboarding.${step.id}Hint`, { count: step.hintCount })}</ITText>
                  )}
                </div>
                {step.done ? (
                  <ITText as="span" className="text-xs font-semibold text-[var(--color-success)]">{t("client.onboarding.done")}</ITText>
                ) : (
                  <ITButton variant="outlined" color="primary" size="sm" onClick={() => navigate(step.to)}>
                    {t("client.onboarding.go")}
                  </ITButton>
                )}
              </li>
            ))}
          </ol>
        </PanelCard>
      )}

      {fx.can.attendance && (
        <PanelCard
          icon={<LuClock3 />}
          title={t("client.attendance.title")}
          actions={seeAll(canTimeClockView ? "/hr/time-clock" : "/mi-jornada")}
        >
          <Block value={fx.attendance}>
            {(a) => {
              const late = a.rows.filter((r) => r.status === "LATE").sort((x, y) => y.lateMin - x.lateMin).slice(0, 5);
              return (
                <div className="flex flex-col gap-4">
                  <ITBentoStatStrip
                    items={[
                      { id: "present", label: t("client.attendance.present"), value: a.counts.PRESENT, caption: t("client.attendance.onSite", { count: a.counts.onSite }), tone: "mint", color: "var(--color-success)" },
                      { id: "late", label: t("client.attendance.late"), value: a.counts.LATE, tone: "sun", color: "var(--color-warning)" },
                      { id: "notArrived", label: t("client.attendance.notArrived"), value: a.counts.NOT_ARRIVED, tone: "rose", color: "var(--color-error)" },
                    ]}
                  />
                  <div>
                    <ITText className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">{t("client.attendance.latest")}</ITText>
                    {late.length === 0 ? (
                      <ITText className="text-sm text-slate-500">{t("client.attendance.noLate")}</ITText>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {late.map((r) => (
                          <li key={r.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{r.name}</span>
                              {r.departmentName ? <span className="text-slate-500"> · {r.departmentName}</span> : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-[var(--color-warning)]">{t("client.attendance.lateMin", { min: r.lateMin })}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            }}
          </Block>
        </PanelCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {fx.can.records && (
          <PanelCard icon={<LuUsersRound />} title={t("client.people.title")} actions={seeAll("/employees")}>
            <Block value={fx.people}>
              {(p) => {
                const dates = [
                  ...p.birthdays.map((b) => ({ key: `b-${b.userId}`, name: b.name, date: b.date, extra: "🎂" })),
                  ...p.anniversaries.map((a) => ({ key: `a-${a.userId}`, name: a.name, date: a.date, extra: t("client.people.years", { count: a.years }) })),
                ].sort((x, y) => x.date.localeCompare(y.date)).slice(0, 5);
                return (
                  <div className="flex flex-col gap-4">
                    <ITBentoStatStrip
                      items={[
                        { id: "active", label: t("client.people.active"), value: p.active, tone: "sea", color: "var(--color-primary-600)" },
                        { id: "hires", label: t("client.people.hires"), value: p.hiresThisMonth, tone: "mint", color: "var(--color-success)" },
                        { id: "departures", label: t("client.people.departures"), value: p.departuresThisMonth, tone: "sun", color: "var(--color-warning)" },
                      ]}
                    />
                    {dates.length === 0 ? (
                      <ITText className="text-sm text-slate-500">{t("client.people.none")}</ITText>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dates.map((d) => (
                          <li key={d.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="min-w-0 truncate font-semibold">{d.name}</span>
                            <span className="shrink-0 text-slate-500">{shortDate(d.date)} · {d.extra}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }}
            </Block>
          </PanelCard>
        )}

        {fx.can.records && (
          <PanelCard icon={<LuFolderOpen />} title={t("client.records.title")} actions={seeAll("/employees/records")}>
            <Block value={fx.records}>
              {(r) => (
                <ITBentoStatStrip
                  items={[
                    { id: "complete", label: t("client.records.complete"), value: `${r.summary.complete} / ${r.summary.employees}`, tone: "mint", color: "var(--color-success)" },
                    { id: "missingRequired", label: t("client.records.missingRequired"), value: r.summary.missingRequired, tone: "rose", color: "var(--color-error)" },
                    { id: "missingFields", label: t("client.records.missingFields"), value: r.summary.missingFields, tone: "sun", color: "var(--color-warning)" },
                  ]}
                />
              )}
            </Block>
          </PanelCard>
        )}

        {fx.can.overtime && (
          <PanelCard icon={<LuCalendarClock />} title={t("client.overtime.title")} actions={seeAll("/schedules/overtime/approval")}>
            <Block value={fx.overtime}>
              {(o) => (
                <div className="flex flex-col gap-4">
                  <ITBentoStatStrip
                    items={[
                      { id: "pending", label: t("client.overtime.pending"), value: t("client.overtime.hours", { value: hours(o.pendingExtraMin) }), tone: "sun", color: "var(--color-warning)" },
                      { id: "approved", label: t("client.overtime.approved"), value: t("client.overtime.hours", { value: hours(o.approvedExtraMin) }), tone: "mint", color: "var(--color-success)" },
                      { id: "rejected", label: t("client.overtime.rejected"), value: t("client.overtime.hours", { value: hours(o.rejectedExtraMin) }), tone: "plain" },
                    ]}
                  />
                  {o.topPending.length > 0 && (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {o.topPending.slice(0, 5).map((p) => (
                        <li key={p.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 truncate font-semibold">{p.name}</span>
                          <span className="shrink-0 tabular-nums text-slate-500">{t("client.overtime.hours", { value: hours(p.pendingExtraMin) })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Block>
          </PanelCard>
        )}

        {fx.can.setup && (
          <PanelCard
            icon={<LuSettings2 />}
            title={t("client.setup.title")}
            actions={canTimeClockView ? seeAll("/hr/time-clock/employees") : undefined}
          >
            <Block value={fx.setup}>
              {(s) => (
                <ITBentoStatStrip
                  items={[
                    { id: "unlinked", label: t("client.setup.unlinked"), value: s.unlinkedClockNumbers, tone: s.unlinkedClockNumbers ? "sun" : "plain" },
                    { id: "withoutClock", label: t("client.setup.withoutClock"), value: s.personalWithoutClock, tone: s.personalWithoutClock ? "sun" : "plain" },
                    { id: "withoutSchedule", label: t("client.setup.withoutSchedule"), value: s.personalWithoutSchedule, tone: s.personalWithoutSchedule ? "sun" : "plain" },
                  ]}
                />
              )}
            </Block>
          </PanelCard>
        )}
      </div>
    </div>
  );
}
