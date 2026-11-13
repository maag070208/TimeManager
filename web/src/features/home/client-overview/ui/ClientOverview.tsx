import type { ReactNode } from "react";
import { ITBadget, ITButton, ITCard, ITSkeleton, ITText } from "@axzydev/axzy_ui_system";
import { useCan } from "@entities/user";
import { LuArrowRight, LuCalendarClock, LuCalendarDays, LuCircleCheck, LuCircle, LuClock3, LuFolderOpen, LuSettings2, LuUsersRound } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dyn } from "@shared/i18n";
import { PanelCard } from "@shared/ui/panel-card";
import { TicState } from "@shared/ui/tic";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { useClientOverview } from "../model/useClientOverview";

const hours = (min: number) => (min / 60).toFixed(1).replace(/\.0$/, "");

function Block<T>({ value, children }: { value: T | null | undefined; children: (v: T) => ReactNode }) {
  const { t } = useTranslation("home");
  if (value === undefined) return null;
  if (value === null) return <TicState kind="error" size="sm" description={t("client.loadError")} />;
  return <>{children(value)}</>;
}

/** Esqueleto con la forma del inicio: jornada de hoy + lateral, indicadores y paneles. */
function OverviewSkeleton() {
  const { t } = useTranslation("common");
  const box = (height: number, className = "") => <ITSkeleton variant="rectangular" height={height} className={`rounded-2xl ${className}`} />;
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">{box(260)}</div>
        <div className="lg:col-span-4">{box(260)}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item}>{box(112)}</div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">{box(220)}</div>
        <div className="lg:col-span-5">{box(220)}</div>
      </div>
    </div>
  );
}

export default function ClientOverview() {
  const { t, i18n } = useTranslation("home");
  const tr = dyn(t);
  const navigate = useNavigate();
  const fx = useClientOverview();
  const canTimeClockView = useCan("time_clock.view");
  const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Date().toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" });

  if (!fx.hasAny) {
    return (
      <PanelCard>
        <TicState kind="empty" title={t("client.nothing.title")} description={t("client.nothing.description")} />
      </PanelCard>
    );
  }

  if (fx.loading) return <OverviewSkeleton />;

  const onboardingSteps = fx.onboarding?.filter((step) => step.id !== "clock" || (fx.hasClock && canTimeClockView)) ?? null;
  const doneSteps = onboardingSteps?.filter((step) => step.done).length ?? 0;
  const pendingSteps = (onboardingSteps?.length ?? 0) - doneSteps;
  // Con el flujo unificado, sin reloj el reporte de Asistencias sigue siendo la
  // pantalla de checadas; el índice del checador deja de existir.
  const attendanceTo = canTimeClockView ? (fx.hasClock ? "/hr/time-clock" : "/hr/time-clock/entries-exits") : "/mi-jornada";
  const seeAll = (to: string) => (
    <ITButton variant="text" color="primary" size="sm" onClick={() => navigate(to)}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {t("client.seeAll")} <LuArrowRight size={12} />
      </span>
    </ITButton>
  );

  const quickActions = [
    fx.can.attendance && { label: "Asistencia", to: attendanceTo, icon: <LuClock3 size={15} /> },
    fx.can.records && { label: "Personal", to: "/employees", icon: <LuUsersRound size={15} /> },
    fx.can.setup && { label: "Horarios", to: "/schedules", icon: <LuCalendarDays size={15} /> },
    fx.can.overtime && { label: "Tiempo extra", to: "/schedules/overtime/approval", icon: <LuCalendarClock size={15} /> },
    fx.can.records && { label: "Nómina", to: "/schedules/payroll", icon: <LuFolderOpen size={15} /> },
  ].filter(Boolean) as Array<{ label: string; to: string; icon: ReactNode }>;

  const kpiItems = [
    ...(fx.people ? [
      { id: "active", label: t("client.people.active"), value: fx.people.active, caption: t("client.people.title"), icon: <LuUsersRound size={14} />, tone: "neutral" as const },
      { id: "hires", label: t("client.people.hires"), value: fx.people.hiresThisMonth, caption: `${fx.people.departuresThisMonth} ${t("client.people.departures").toLowerCase()}`, icon: <LuCalendarDays size={14} />, tone: "success" as const },
    ] : []),
    ...(fx.records ? [
      { id: "records", label: t("client.records.complete"), value: `${fx.records.summary.complete}/${fx.records.summary.employees}`, caption: `${fx.records.summary.missingRequired} sin documento`, icon: <LuFolderOpen size={14} />, tone: "info" as const },
    ] : []),
    ...(fx.setup ? [
      { id: "setup", label: "Por configurar", value: (fx.hasClock ? fx.setup.unlinkedClockNumbers + fx.setup.personalWithoutClock : 0) + fx.setup.personalWithoutSchedule, caption: fx.hasClock ? "sin reloj o sin horario" : "personas sin horario", icon: <LuSettings2 size={14} />, tone: "warning" as const },
    ] : []),
  ];

  const attendanceHero = fx.attendance && (() => {
    const a = fx.attendance!;
    // Tres lecturas que no se mezclan: quién llegó de los programados de hoy,
    // cómo llegó, y quién sigue adentro ahorita (quien ya salió llegó, pero ya no está).
    const arrived = a.counts.PRESENT + a.counts.LATE;
    const scheduled = arrived + a.counts.NOT_ARRIVED;
    const finished = Math.max(0, arrived - a.counts.onSite);
    const withoutSchedule = fx.setup?.personalWithoutSchedule ?? 0;
    return (
      <ITCard contentClassName="!p-0">
        <div className="tm-hero-card dash-card rounded-2xl p-5 text-slate-900" style={{ borderColor: "#eef1f5" }}>
          <div className="relative flex flex-wrap items-start justify-between gap-2">
            <div>
              <ITText className="!text-[10.5px] font-semibold uppercase tracking-[0.12em] !text-slate-500">Hoy</ITText>
              <ITText className="!text-[20px] font-extrabold !text-slate-900">{today}</ITText>
            </div>
            <div className="flex items-center gap-2">
              <ITBadget color="success" size="sm">{a.counts.onSite} en sitio ahora</ITBadget>
              {seeAll(attendanceTo)}
            </div>
          </div>

          {scheduled === 0 && withoutSchedule > 0 ? (
            <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
              <div>
                <ITText className="!text-[24px] font-black !text-slate-900">{withoutSchedule} sin horario</ITText>
                <ITText className="!text-[12px] !text-slate-600">Nadie tiene horario asignado hoy; así no podemos calcular asistencia.</ITText>
              </div>
              <ITButton variant="filled" color="success" size="sm" className="tm-row-button" onClick={() => navigate("/schedules")}>
                Asignar horarios <LuArrowRight size={12} />
              </ITButton>
            </div>
          ) : (
            <div className="relative mt-4">
              <div className="flex items-end justify-between gap-2">
                <span className="text-[34px] font-black leading-none">{arrived}<span className="text-[18px] font-bold text-slate-500"> de {scheduled} llegaron</span></span>
                <span className="text-[11.5px] text-slate-500">{scheduled === 0 ? "Sin checadas hoy" : "Jornada en curso"}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70">
                <div className="dash-bar h-full rounded-full bg-emerald-400" style={{ width: `${scheduled ? Math.min(100, Math.round((arrived / scheduled) * 100)) : 0}%` }} />
              </div>
              {finished > 0 && (
                <ITText className="mt-2 block !text-[12px] !text-slate-500">
                  {finished} ya terminaron su turno · {a.counts.onSite} siguen en sitio
                </ITText>
              )}
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                {[
                  { label: t("client.attendance.present"), value: a.counts.PRESENT, color: "text-emerald-600" },
                  { label: t("client.attendance.late"), value: a.counts.LATE, color: "text-amber-600" },
                  { label: t("client.attendance.notArrived"), value: a.counts.NOT_ARRIVED, color: "text-rose-500" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-slate-50/80 px-2.5 py-2">
                    <span className="block text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</span>
                    <span className={`block text-[20px] font-black tabular-nums ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingSteps > 0 && quickActions.length > 0 && (
            <div className="relative mt-4 flex flex-wrap gap-1.5 border-t border-slate-200/50 pt-3">
              {quickActions.map((action) => (
                <button key={action.label} type="button" onClick={() => navigate(action.to)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 transition hover:bg-slate-100">
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </ITCard>
    );
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-12">
        {fx.can.attendance && (
          <div className="lg:col-span-8">
            {attendanceHero ?? (
              <PanelCard icon={<LuClock3 size={16} />} title={t("client.attendance.title")}>
                <TicState kind="error" size="sm" description={t("client.loadError")} />
              </PanelCard>
            )}
          </div>
        )}
        <div className={fx.can.attendance ? "lg:col-span-4" : "lg:col-span-12"}>
          {onboardingSteps && pendingSteps > 0 ? (
            <PanelCard icon={<LuCircleCheck size={16} />} title={t("client.onboarding.title")} description={`${doneSteps} de ${onboardingSteps.length} completados`}>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="dash-bar h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((doneSteps / Math.max(1, onboardingSteps.length)) * 100)}%` }} />
              </div>
              <ol className="flex flex-col gap-1.5">
                {onboardingSteps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                    {step.done ? <LuCircleCheck size={16} className="shrink-0 text-emerald-600" /> : <LuCircle size={16} className="shrink-0 text-slate-300" />}
                    <div className="min-w-0 flex-1">
                      <ITText className={`block truncate !text-[12px] font-semibold ${step.done ? "!text-slate-400" : "!text-slate-800"}`}>{tr(`client.onboarding.${step.id}`)}</ITText>
                      {!step.done && <ITText className="block !text-[10.5px] text-slate-500">{tr(`client.onboarding.${step.id}Hint`, { count: step.hintCount })}</ITText>}
                    </div>
                    {!step.done && (
                      <ITButton variant="outlined" color="primary" size="sm" className="tm-icon-button" aria-label={`${t("client.onboarding.go")}: ${tr(`client.onboarding.${step.id}`)}`} title={`${t("client.onboarding.go")}: ${tr(`client.onboarding.${step.id}`)}`} onClick={() => navigate(step.to)}>
                        <LuArrowRight size={13} />
                      </ITButton>
                    )}
                  </li>
                ))}
              </ol>
            </PanelCard>
          ) : (
            <PanelCard icon={<LuArrowRight size={16} />} title="Accesos rápidos">
              <div className="flex flex-col gap-1.5">
                {quickActions.map((action) => (
                  <button key={action.label} type="button" onClick={() => navigate(action.to)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                    <span className="flex items-center gap-2">{action.icon} {action.label}</span>
                    <LuArrowRight size={13} className="text-slate-300" />
                  </button>
                ))}
              </div>
            </PanelCard>
          )}
        </div>
      </div>

      <BentoKpiGrid items={kpiItems} />

      <div className="grid items-start gap-4 lg:grid-cols-12">
        {fx.can.attendance && fx.attendance && (fx.attendance.counts.PRESENT + fx.attendance.counts.LATE + fx.attendance.counts.NOT_ARRIVED) > 0 && (
          <PanelCard className="lg:col-span-7" icon={<LuClock3 size={16} />} title={t("client.attendance.title")} actions={seeAll(attendanceTo)}>
            <Block value={fx.attendance}>
              {(a) => {
                // Lo que RH necesita atender hoy: primero quien no ha llegado, luego los retardos.
                const pending = [
                  ...a.rows.filter((r) => r.status === "NOT_ARRIVED").sort((x, y) => (x.scheduledStartAt ?? "").localeCompare(y.scheduledStartAt ?? "")),
                  ...a.rows.filter((r) => r.status === "LATE").sort((x, y) => y.lateMin - x.lateMin),
                ];
                const shown = pending.slice(0, 6);
                return pending.length === 0 ? (
                  <ITText className="block rounded-xl bg-emerald-50/60 px-3 py-4 text-center !text-[12.5px] text-emerald-800">{t("client.attendance.allOnTime")}</ITText>
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100">
                      {shown.map((r) => (
                        <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                          <span className="min-w-0 truncate"><span className="font-semibold text-slate-800">{r.name}</span>{r.departmentName ? <span className="text-slate-500"> · {r.departmentName}</span> : null}</span>
                          {r.status === "LATE" ? (
                            <ITBadget color="warning" size="sm">{t("client.attendance.lateMin", { min: r.lateMin })}</ITBadget>
                          ) : (
                            <span className="flex shrink-0 items-center gap-2">
                              {r.scheduledStartAt && <span className="tabular-nums text-slate-500">{t("client.attendance.dueAt", { time: timeOf(r.scheduledStartAt) })}</span>}
                              <ITBadget color="danger" size="sm">{t("client.attendance.notArrived")}</ITBadget>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {pending.length > shown.length && (
                      <ITText className="mt-2 block !text-[11.5px] text-slate-500">{t("client.attendance.more", { count: pending.length - shown.length })}</ITText>
                    )}
                  </>
                );
              }}
            </Block>
          </PanelCard>
        )}

        {fx.can.setup && fx.setup && (fx.attendance ? (fx.attendance.counts.PRESENT + fx.attendance.counts.LATE + fx.attendance.counts.NOT_ARRIVED) === 0 : true) && (
          <PanelCard className="lg:col-span-7" icon={<LuSettings2 size={16} />} title="Pendientes de configuración" description="Para que la asistencia empiece a calcularse.">
            <div className="flex flex-col gap-2">
              {[
                { label: "Personas sin horario asignado", value: fx.setup.personalWithoutSchedule, to: "/schedules", icon: <LuCalendarDays size={14} /> },
                ...(fx.hasClock
                  ? [
                      { label: "Personas sin reloj vinculado", value: fx.setup.personalWithoutClock, to: "/hr/time-clock/employees", icon: <LuClock3 size={14} /> },
                      { label: "Números de reloj sin vincular", value: fx.setup.unlinkedClockNumbers, to: "/hr/time-clock/employees", icon: <LuSettings2 size={14} /> },
                    ]
                  : []),
              ].filter((row) => row.value > 0).map((row) => (
                <button key={row.label} type="button" onClick={() => navigate(row.to)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-left transition hover:bg-slate-100">
                  <span className="flex items-center gap-2 text-[12.5px] text-slate-700">{row.icon} {row.label}</span>
                  <span className="flex items-center gap-2"><strong className="text-[15px] text-slate-900">{row.value}</strong> <LuArrowRight size={13} className="text-slate-400" /></span>
                </button>
              ))}
              {(fx.hasClock ? fx.setup.personalWithoutSchedule + fx.setup.personalWithoutClock + fx.setup.unlinkedClockNumbers : fx.setup.personalWithoutSchedule) === 0 && (
                <ITText className="block rounded-xl bg-emerald-50/60 px-3 py-4 text-center !text-[12.5px] text-emerald-800">Configuración completa.</ITText>
              )}
            </div>
          </PanelCard>
        )}

        {fx.can.records && fx.records && (
          <PanelCard className="lg:col-span-5" icon={<LuFolderOpen size={16} />} title={t("client.records.title")} actions={seeAll("/employees/records")}>
            <Block value={fx.records}>
              {(r) => {
                const pct = Math.round((r.summary.complete / Math.max(1, r.summary.employees)) * 100);
                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <span className="text-[26px] font-black text-slate-900">{pct}%</span>
                      <span className="text-[11.5px] text-slate-500">{r.summary.complete} de {r.summary.employees} completos</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="dash-bar h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                    <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                      <span className="rounded-lg bg-rose-50 px-2.5 py-2 text-rose-700"><strong className="block text-[16px]">{r.summary.missingRequired}</strong> {t("client.records.missingRequired")}</span>
                      <span className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-700"><strong className="block text-[16px]">{r.summary.missingFields}</strong> {t("client.records.missingFields")}</span>
                    </div>
                  </div>
                );
              }}
            </Block>
          </PanelCard>
        )}

        {fx.can.records && fx.people && (fx.people.birthdays.length > 0 || fx.people.anniversaries.length > 0) && (
          <PanelCard className="lg:col-span-7" icon={<LuUsersRound size={16} />} title={t("client.people.title")} actions={seeAll("/employees")}>
            <Block value={fx.people}>
              {(p) => {
                const dates = [
                  ...p.birthdays.map((b) => ({ key: `b-${b.userId}`, name: b.name, date: b.date, extra: "🎂" })),
                  ...p.anniversaries.map((a) => ({ key: `a-${a.userId}`, name: a.name, date: a.date, extra: t("client.people.years", { count: a.years }) })),
                ].sort((x, y) => x.date.localeCompare(y.date)).slice(0, 5);
                return dates.length === 0 ? (
                  <ITText className="block py-3 text-center !text-[12.5px] text-slate-500">{t("client.people.none")}</ITText>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dates.map((d) => (
                      <li key={d.key} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                        <span className="min-w-0 truncate font-semibold text-slate-800">{d.name}</span>
                        <span className="shrink-0 text-slate-500">{shortDate(d.date)} · {d.extra}</span>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </Block>
          </PanelCard>
        )}

        {fx.can.overtime && fx.overtime && (fx.overtime.pendingExtraMin > 0 || fx.overtime.approvedExtraMin > 0 || fx.overtime.topPending.length > 0) && (
          <PanelCard className="lg:col-span-5" icon={<LuCalendarClock size={16} />} title={t("client.overtime.title")} actions={seeAll("/schedules/overtime/approval")}>
            <Block value={fx.overtime}>
              {(o) => (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-700"><strong className="block text-[20px]">{hours(o.pendingExtraMin)} h</strong>{t("client.overtime.pending")}</span>
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[11.5px] text-emerald-700"><strong className="block text-[20px]">{hours(o.approvedExtraMin)} h</strong>{t("client.overtime.approved")}</span>
                  </div>
                  {o.topPending.slice(0, 4).map((p) => (
                    <div key={p.userId} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 truncate font-semibold text-slate-800">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{t("client.overtime.hours", { value: hours(p.pendingExtraMin) })}</span>
                    </div>
                  ))}
                </div>
              )}
            </Block>
          </PanelCard>
        )}
      </div>
    </div>
  );
}
