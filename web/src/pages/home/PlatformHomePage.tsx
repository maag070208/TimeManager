import { useMemo, useState, type ReactNode } from "react";
import { ITAlert, ITButton, ITInput, ITPage } from "@axzydev/axzy_ui_system";
import { LuArrowUpRight, LuBadgeDollarSign, LuBuilding2, LuCalendarClock, LuChartColumn, LuLayoutDashboard, LuPlus, LuUsersRound, LuWallet } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AgentTokenDialog, CreateTenantDialog, PlanAssignDialog, TenantsTable, useTenantsConsole } from "@features/tenant/tenants-console";
import { tenantHost } from "@shared/api/tenant";
import type { Tenant } from "@entities/tenant";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { PanelCard } from "@shared/ui/panel-card";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { TicState } from "@shared/ui/tic";

const money = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const monthLabel = (date: Date) => date.toLocaleDateString("es-MX", { month: "short" }).replace(/\./g, "");

type MonthPoint = { label: string; newClients: number; total: number };

function ClientsChart({ months }: { months: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 620;
  const height = 170;
  const pad = { left: 28, right: 14, top: 12, bottom: 24 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(2, ...months.map((month) => Math.max(month.total, month.newClients)));
  const x = (index: number) => pad.left + (months.length <= 1 ? plotW / 2 : (index / (months.length - 1)) * plotW);
  const y = (value: number) => pad.top + (1 - value / max) * plotH;
  const points = months.map((month, index) => ({ x: x(index), y: y(month.total), ...month }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points[points.length - 1]?.x ?? pad.left},${pad.top + plotH} L${points[0]?.x ?? pad.left},${pad.top + plotH} Z`;
  const barWidth = Math.min(30, plotW / Math.max(1, months.length) / 2.6);
  const ticks = Array.from({ length: max + 1 }, (_, index) => index);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Altas de clientes por mes" className="w-full">
        <defs>
          <linearGradient id="platform-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-600)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary-600)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="platform-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#eef1f5" strokeDasharray="3 5" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tick}</text>
          </g>
        ))}
        {months.map((month, index) => (
          <rect
            key={`bar-${month.label}`}
            x={x(index) - barWidth / 2}
            y={y(month.newClients)}
            width={barWidth}
            height={Math.max(0, pad.top + plotH - y(month.newClients))}
            rx={6}
            fill="url(#platform-bar)"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <path d={area} fill="url(#platform-area)" />
        <path d={line} fill="none" stroke="var(--color-primary-600)" strokeWidth="2.4" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={`dot-${point.label}`} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
            <circle cx={point.x} cy={point.y} r={4} fill="#fff" stroke="var(--color-primary-600)" strokeWidth="2.2" />
            <rect x={x(index) - plotW / Math.max(1, months.length) / 2} y={pad.top} width={plotW / Math.max(1, months.length)} height={plotH} fill="transparent" />
          </g>
        ))}
        {months.map((month, index) => (
          <text key={`label-${month.label}`} x={x(index)} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b">{month.label}</text>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg bg-[#0f2e3d] px-3 py-2 text-[11.5px] text-white shadow-lg">
          <strong className="block capitalize">{months[hover].label}</strong>
          Altas: {months[hover].newClients} · Acumulado: {months[hover].total}
        </div>
      )}
    </div>
  );
}

function StatusDonut({ active, suspended }: { active: number; suspended: number }) {
  const total = Math.max(1, active + suspended);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const activeDash = (active / total) * circumference;
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative">
        <svg viewBox="0 0 140 140" className="h-[168px] w-[168px] -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef1f5" strokeWidth="16" />
          <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-success)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${activeDash} ${circumference}`} className="dash-donut" />
          {suspended > 0 && (
            <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-warning)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(suspended / total) * circumference} ${circumference}`} strokeDashoffset={-activeDash} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-black leading-none text-slate-900">{active}</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">activos</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {[
          { label: "Activos", value: active, color: "var(--color-success)" },
          { label: "Suspendidos", value: suspended, color: "var(--color-warning)" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ background: row.color }} /> {row.label}
            </span>
            <span className="font-bold tabular-nums text-slate-800">{row.value} <span className="font-normal text-slate-400">({Math.round((row.value / total) * 100)}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CardWaves = ({ color = "rgba(255,255,255,0.16)", className = "" }: { color?: string; className?: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 600 70"
    preserveAspectRatio="none"
    className={`dash-waves pointer-events-none absolute inset-x-0 bottom-0 h-[62px] w-[200%] ${className}`}
  >
    <path d="M0,40 C90,10 150,65 240,40 C330,15 390,62 480,38 C540,24 570,30 600,40 L600,70 L0,70 Z" fill={color} />
    <path d="M0,50 C100,28 160,70 260,48 C360,26 420,66 520,46 C560,38 580,42 600,50 L600,70 L0,70 Z" fill={color} opacity="0.55" />
  </svg>
);

const nextChargeDate = (createdAt: string): Date => {
  const created = new Date(createdAt);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), Math.min(created.getDate(), 28));
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return new Date(now.getFullYear(), now.getMonth() + 1, Math.min(created.getDate(), 28));
  }
  return candidate;
};

/** Inicio del equipo TimeManager: clientes, estado y uso. */
export default function PlatformHomePage() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const fx = useTenantsConsole();
  const [creating, setCreating] = useState(false);
  const [planTarget, setPlanTarget] = useState<Tenant | null>(null);
  const [agentTarget, setAgentTarget] = useState<Tenant | null>(null);
  const target = fx.statusTarget;
  const suspending = target?.status === "ACTIVE";

  const newClient = fx.canManage ? (
    <ITButton variant="filled" color="primary" className="tm-save-button" onClick={() => setCreating(true)}>
      <span className="flex items-center gap-1.5 text-[12px] font-bold">
        <LuPlus aria-hidden size={14} />
        {t("platform.newClient")}
      </span>
    </ITButton>
  ) : undefined;

  const tenants = useMemo(() => fx.tenants ?? [], [fx.tenants]);
  const summary = useMemo(() => {
    const active = tenants.filter((tenant) => tenant.status === "ACTIVE");
    const suspended = tenants.filter((tenant) => tenant.status === "SUSPENDED");
    const mrr = active.reduce((sum, tenant) => sum + Number(tenant.plan?.monthlyPrice ?? 0), 0);
    const people = active.reduce((sum, tenant) => sum + tenant.usage.activeUsers, 0);
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const created = tenants.filter((tenant) => new Date(tenant.createdAt) < end);
      return {
        label: monthLabel(date),
        newClients: created.filter((tenant) => {
          const at = new Date(tenant.createdAt);
          return at >= date && at < end;
        }).length,
        total: created.length,
      };
    });
    const planMap = new Map<string, { label: string; count: number; mrr: number }>();
    for (const tenant of active) {
      const label = tenant.plan?.name ?? "Sin plan";
      const current = planMap.get(label) ?? { label, count: 0, mrr: 0 };
      current.count += 1;
      current.mrr += Number(tenant.plan?.monthlyPrice ?? 0);
      planMap.set(label, current);
    }
    const plans = [...planMap.values()].sort((a, b) => b.count - a.count);
    const upcoming = active
      .filter((tenant) => Number(tenant.plan?.monthlyPrice ?? 0) > 0)
      .map((tenant) => ({ tenant, date: nextChargeDate(tenant.createdAt), amount: Number(tenant.plan?.monthlyPrice ?? 0) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
    return { active, suspended, mrr, people, months, plans, upcoming };
  }, [tenants]);

  const kpis = [
    {
      label: "Clientes",
      value: tenants.length,
      caption: `${summary.active.length} activos · ${summary.suspended.length} suspendidos`,
      icon: <LuBuilding2 size={15} />,
      wave: "rgba(15,46,61,0.10)",
      dot: "bg-slate-800",
      chip: "bg-slate-100 text-slate-700",
    },
    {
      label: "Personas activas",
      value: summary.people,
      caption: "en clientes activos",
      icon: <LuUsersRound size={15} />,
      wave: "rgba(16,185,129,0.14)",
      dot: "bg-emerald-500",
      chip: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Ingreso mensual",
      value: money(summary.mrr),
      caption: "estimado por plan",
      icon: <LuBadgeDollarSign size={15} />,
      wave: "rgba(245,158,11,0.16)",
      dot: "bg-amber-500",
      chip: "bg-amber-50 text-amber-700",
    },
    {
      label: "Por cobrar",
      value: money(summary.upcoming.reduce((sum, row) => sum + row.amount, 0)),
      caption: "próximos cobros del mes",
      icon: <LuArrowUpRight size={15} />,
      wave: "rgba(14,165,233,0.14)",
      dot: "bg-sky-500",
      chip: "bg-sky-50 text-sky-700",
    },
  ] as Array<{ label: string; value: string | number; caption: string; icon: ReactNode; wave: string; dot: string; chip: string }>;

  return (
    <ITPage
      className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={t("platform.title")}
      description={t("platform.description")}
      icon={<LuLayoutDashboard size={20} />}
      actions={newClient}
      loading={fx.tenants === null && !fx.error}
    >
      <div className="flex flex-col gap-4">
        {fx.error && (
          <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
            {fx.error}
          </ITAlert>
        )}

        {fx.tenants && fx.tenants.length === 0 ? (
          <TicState kind="empty" title={t("platform.empty.title")} description={t("platform.empty.description")} action={newClient} />
        ) : (
          <>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {kpis.map((kpi, index) => (
                <div
                  key={kpi.label}
                  className="dash-kpi dash-card relative flex flex-col gap-1 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm"
                  style={{ animationDelay: `${index * 60}ms`, borderColor: "#eef1f5" }}
                >
                  <CardWaves color={kpi.wave} />
                  <span className="relative flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${kpi.chip}`}>{kpi.icon}</span>
                    {kpi.label}
                  </span>
                  <span className="dash-value relative mt-1 text-[30px] font-black leading-tight tabular-nums text-slate-900">{kpi.value}</span>
                  <span className="relative text-[11.5px] text-slate-500">{kpi.caption}</span>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-12">
              <div className="dash-card lg:col-span-8">
                <PanelCard title="Altas de clientes" icon={<LuChartColumn size={16} />} description="Nuevos clientes por mes y acumulado de la plataforma.">
                  <ClientsChart months={summary.months} />
                  <div className="mt-2 flex items-center gap-4 text-[11.5px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-primary-600)]" /> Acumulado</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> Altas del mes</span>
                  </div>
                </PanelCard>
              </div>

              <div className="dash-card lg:col-span-4">
                <PanelCard title="Estado de clientes" icon={<LuBuilding2 size={16} />}>
                  <StatusDonut active={summary.active.length} suspended={summary.suspended.length} />
                </PanelCard>
              </div>

              <div className="dash-card lg:col-span-7">
                <PanelCard
                  title="Próximos cobros"
                  icon={<LuCalendarClock size={16} />}
                  description="Estimado según plan y fecha de alta; aún sin pasarela de cobro."
                >
                  <div className="mt-2 flex flex-col gap-2">
                    {summary.upcoming.length === 0 && (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                          <LuCalendarClock size={18} />
                        </span>
                        <span className="text-[13px] font-semibold text-slate-700">Sin cobros programados</span>
                        <span className="max-w-[280px] text-[11.5px] text-slate-500">
                          Asigna un plan con precio a los clientes activos para ver el próximo cobro estimado.
                        </span>
                        {fx.canManage && summary.active[0] && (
                          <ITButton variant="outlined" color="primary" size="sm" className="tm-save-button" onClick={() => setPlanTarget(summary.active[0])}>
                            Asignar plan
                          </ITButton>
                        )}
                      </div>
                    )}
                    {summary.upcoming.map((row) => (
                      <button
                        key={row.tenant.id}
                        type="button"
                        onClick={() => navigate(`/tenants/${row.tenant.id}`)}
                        className="group flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-slate-800">{row.tenant.name}</span>
                          <span className="block text-[11px] text-slate-500">{row.tenant.plan?.name ?? "Sin plan"} · {row.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold tabular-nums">{money(row.amount)}</span>
                          <span className="text-[11px] font-semibold text-slate-400 transition group-hover:text-slate-700">Ver kardex →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </PanelCard>
              </div>

              <div className="dash-card lg:col-span-5">
                <PanelCard title="Uso por plan" icon={<LuWallet size={16} />} description="Clientes activos y MRR por plan contratado.">
                  <div className="mt-2 flex flex-col gap-3">
                    {summary.plans.length === 0 && (
                      <span className="text-[12.5px] text-slate-500">Sin planes asignados todavía.</span>
                    )}
                    {summary.plans.map((plan) => (
                      <div key={plan.label} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="flex items-center gap-2 font-semibold text-slate-700">
                            <span className={`h-2 w-2 rounded-full ${plan.label === "Sin plan" ? "bg-slate-300" : "bg-[var(--color-primary-600)]"}`} />
                            {plan.label}
                          </span>
                          <span className="text-slate-500">{plan.count} clientes · <strong className="text-slate-700">{money(plan.mrr)}</strong></span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                          <div
                            className="dash-bar h-full rounded-full bg-[var(--color-primary-600)]"
                            style={{ width: `${Math.round((plan.count / Math.max(1, summary.active.length)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </PanelCard>
              </div>
            </div>

            <PanelCard title={t("platform.listTitle")} description={t("platform.listDescription")}>
              {fx.tenants === null ? (
                <ContentSkeleton size="sm" />
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="max-w-sm">
                    <ITInput name="tenantSearch" placeholder={t("platform.search")} value={fx.search} onChange={(e) => fx.setSearch(e.target.value)} />
                  </div>
                  {fx.visible.length === 0 ? (
                    <TicState kind="noResults" size="sm" title={t("platform.noResults.title")} description={t("platform.noResults.description")} />
                  ) : (
                    <TenantsTable
                      rows={fx.visible}
                      canManage={fx.canManage}
                      onEnter={fx.enter}
                      onToggleStatus={fx.setStatusTarget}
                      onEditPlan={setPlanTarget}
                      onManageAgent={setAgentTarget}
                      onManageClocks={fx.manageClocks}
                    />
                  )}
                </div>
              )}
            </PanelCard>
          </>
        )}
      </div>

      <CreateTenantDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={fx.reload} />

      <PlanAssignDialog
        isOpen={!!planTarget}
        tenant={planTarget}
        onClose={() => setPlanTarget(null)}
        onSaved={fx.reload}
      />

      <AgentTokenDialog
        isOpen={!!agentTarget}
        tenant={agentTarget}
        onClose={() => setAgentTarget(null)}
      />

      <TicConfirm
        isOpen={!!target}
        onClose={() => fx.setStatusTarget(null)}
        onConfirm={() => void fx.confirmStatus()}
        loading={fx.savingStatus}
        variant={suspending ? "danger" : "success"}
        title={target ? t(suspending ? "platform.confirm.suspendTitle" : "platform.confirm.reactivateTitle", { name: target.name }) : undefined}
        message={target ? t(suspending ? "platform.confirm.suspendMessage" : "platform.confirm.reactivateMessage", { host: tenantHost(target.slug) }) : undefined}
        confirmLabel={t(suspending ? "platform.confirm.suspend" : "platform.confirm.reactivate")}
      />
    </ITPage>
  );
}
