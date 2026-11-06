import { useMemo, useState, type ReactNode } from "react";
import { ITAlert, ITBentoDonut, ITButton, ITInput, ITLineBarChart, ITPage } from "@axzydev/axzy_ui_system";
import { LuArrowUpRight, LuBadgeDollarSign, LuBuilding2, LuLayoutDashboard, LuPlus, LuUsersRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
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
    { label: "Clientes", value: tenants.length, caption: `${summary.active.length} activos`, icon: <LuBuilding2 size={15} />, className: "bg-[#0f2e3d] text-white", muted: "text-white/60" },
    { label: "Personas activas", value: summary.people, caption: "en clientes activos", icon: <LuUsersRound size={15} />, className: "bg-white", muted: "text-slate-400" },
    { label: "Ingreso mensual", value: money(summary.mrr), caption: "estimado por plan", icon: <LuBadgeDollarSign size={15} />, className: "bg-white", muted: "text-slate-400" },
    { label: "Por cobrar", value: money(summary.upcoming.reduce((sum, row) => sum + row.amount, 0)), caption: "próximos cobros", icon: <LuArrowUpRight size={15} />, className: "bg-white", muted: "text-slate-400" },
  ] as Array<{ label: string; value: string | number; caption: string; icon: ReactNode; className: string; muted: string }>;

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
                  className={`dash-card flex flex-col gap-1 rounded-2xl border border-slate-100 p-4 shadow-sm ${kpi.className}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className={`flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${kpi.muted}`}>
                    {kpi.icon} {kpi.label}
                  </span>
                  <span className="text-[28px] font-black leading-tight tabular-nums">{kpi.value}</span>
                  <span className={`text-[11.5px] ${kpi.muted}`}>{kpi.caption}</span>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-12">
              <div className="dash-card lg:col-span-8">
                <PanelCard title="Altas de clientes" description="Nuevos clientes por mes y acumulado de la plataforma.">
                  <ITLineBarChart
                    data={summary.months.map((month) => ({ label: month.label, bar: month.newClients, line: month.total }))}
                    ariaLabel="Altas de clientes por mes"
                    lineLabel="Clientes acumulados"
                    barLabel="Altas del mes"
                    lineColor="var(--color-primary-600)"
                    barColor="var(--color-success)"
                    height={230}
                    formatValue={(value) => String(value)}
                    formatAxis={(value) => String(Math.round(value))}
                  />
                </PanelCard>
              </div>

              <div className="dash-card lg:col-span-4">
                <PanelCard title="Estado de clientes">
                  <div className="flex items-center justify-center py-2">
                    <ITBentoDonut
                      segments={[
                        { label: "Activos", value: summary.active.length, color: "var(--color-success)" },
                        { label: "Suspendidos", value: summary.suspended.length, color: "var(--color-warning)" },
                      ]}
                      center={<span className="text-[26px] font-black">{summary.active.length}</span>}
                      caption="clientes activos"
                      size={170}
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> Activos</span>
                      <strong>{summary.active.length}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" /> Suspendidos</span>
                      <strong>{summary.suspended.length}</strong>
                    </div>
                  </div>
                </PanelCard>
              </div>

              <div className="dash-card lg:col-span-7">
                <PanelCard
                  title="Próximos cobros"
                  description="Estimado según plan y fecha de alta; aún sin pasarela de cobro."
                >
                  <div className="mt-2 flex flex-col gap-2">
                    {summary.upcoming.length === 0 && (
                      <span className="text-[12.5px] text-slate-500">No hay cobros estimados: asigna un plan con precio a los clientes activos.</span>
                    )}
                    {summary.upcoming.map((row) => (
                      <div key={row.tenant.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5">
                        <div className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-slate-800">{row.tenant.name}</span>
                          <span className="block text-[11px] text-slate-500">{row.tenant.plan?.name ?? "Sin plan"} · {row.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold tabular-nums">{money(row.amount)}</span>
                          <ITButton variant="outlined" color="secondary" size="sm" className="tm-save-button" onClick={() => fx.enter(row.tenant)}>
                            Entrar
                          </ITButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </PanelCard>
              </div>

              <div className="dash-card lg:col-span-5">
                <PanelCard title="Uso por plan" description="Clientes activos y MRR por plan contratado.">
                  <div className="mt-2 flex flex-col gap-3">
                    {summary.plans.length === 0 && (
                      <span className="text-[12.5px] text-slate-500">Sin planes asignados todavía.</span>
                    )}
                    {summary.plans.map((plan) => (
                      <div key={plan.label}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-slate-700">{plan.label}</span>
                          <span className="text-slate-500">{plan.count} clientes · {money(plan.mrr)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
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
