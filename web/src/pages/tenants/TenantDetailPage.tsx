import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITDatePicker,
  ITDialog,
  ITInput,
  ITSlideToggle,
  ITText,
  ITToast,
  ITTable,
  type Column,
} from "@axzydev/axzy_ui_system";
import { LuBuilding2, LuCheck, LuChevronRight, LuClock, LuClock3, LuCreditCard, LuExternalLink, LuKeyRound, LuLogIn, LuPause, LuPencil, LuPlay, LuPlus, LuSearch, LuWallet } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { tenantApi } from "@entities/tenant";
import { useCan } from "@entities/user";
import type { Tenant, TenantPayment, TenantPaymentStatus, TenantPayments } from "@entities/tenant";
import { AgentTokenDialog, PlanAssignDialog, TenantEditDialog, useTenantActions } from "@features/tenant/tenants-console";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { getSelectedTenant, setSelectedTenant, tenantHost, tenantUrl } from "@shared/api/tenant";
import { TENANT_MODULES, type TenantModuleDefinition } from "@shared/lib/tenant-modules";
import { ITPage } from "@shared/ui/page";
import { TabBar } from "@shared/ui/tab-bar";

const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateStrToLocal = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
};
const localToDateStr = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const STATUS: Record<TenantPaymentStatus, { label: string; color: "success" | "warning" | "danger" | "gray" }> = {
  PAID: { label: "Pagado", color: "success" },
  PENDING: { label: "Pendiente", color: "warning" },
  OVERDUE: { label: "Vencido", color: "danger" },
  CANCELLED: { label: "Cancelado", color: "gray" },
};
const TONE: Record<TenantModuleDefinition["tone"], string> = {
  mint: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  lavender: "bg-violet-50 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
};
type Tab = "summary" | "modules" | "billing" | "activity";
interface ActivityLog { id: string; date: string; event: string; detail: string; user: string; }

const logColumns: Column<ActivityLog>[] = [
  { key: "date", label: "Fecha", type: "string", width: 130, render: (row) => <span className="text-[12px] text-slate-500">{dateLabel(row.date)}</span> },
  { key: "event", label: "Evento", type: "string", width: 190, render: (row) => <span className="text-[12px] font-semibold text-slate-800">{row.event}</span> },
  { key: "detail", label: "Detalle", type: "string", render: (row) => <span className="text-[12px] text-slate-600">{row.detail}</span> },
  { key: "user", label: "Usuario", type: "string", width: 150, render: (row) => <span className="text-[12px] text-slate-500">{row.user}</span> },
];

/** Detalle del cliente: configuración, módulos, cobros y actividad. */
export default function TenantDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("home");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [payments, setPayments] = useState<TenantPayments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [search, setSearch] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const canManage = useCan("tenants.manage");
  const [editOpen, setEditOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const actions = useTenantActions((updated) => {
    setTenant(updated);
    setToast(updated.status === "ACTIVE" ? "Cliente reactivado." : "Cliente suspendido.");
  });
  const [extraLogs, setExtraLogs] = useState<ActivityLog[]>([]);
  const [form, setForm] = useState({ concept: "Suscripción mensual", period: new Date().toISOString().slice(0, 7), amount: "", dueDate: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    try {
      const [nextTenant, nextPayments] = await Promise.all([tenantApi.get(id), tenantApi.payments(id)]);
      setTenant(nextTenant);
      setPayments(nextPayments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el cliente.");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const disabled = tenant?.disabledModules ?? [];
  const activeModules = TENANT_MODULES.filter((module) => !disabled.includes(module.id));
  const planPrice = Number(tenant?.plan?.monthlyPrice ?? 0);
  const setup = [
    { id: "plan", label: "Asignar plan", done: Boolean(tenant?.plan), caption: tenant?.plan ? `${tenant.plan.name} · ${money(planPrice)}/mes` : "Define precio y ciclo de cobro", action: () => setPlanOpen(true) },
    { id: "limit", label: "Definir límite de personas", done: Boolean(tenant?.limits.people), caption: `Hoy: ${tenant?.usage.activeUsers ?? 0} activas, ${tenant?.limits.people ?? "sin límite"}`, action: () => undefined },
    { id: "modules", label: "Módulos activados", done: activeModules.length > 0, caption: `${activeModules.length} de ${TENANT_MODULES.length} activos`, action: () => setTab("modules") },
  ];
  const setupDone = setup.filter((step) => step.done).length;
  const logs = useMemo(() => {
    const paymentLogs = (payments?.rows ?? []).map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paidAt ?? payment.createdAt,
      event: payment.status === "PAID" ? "Pago registrado" : "Cargo registrado",
      detail: `${payment.concept} · ${payment.period} · ${money(payment.amount)}`,
      user: "Plataforma",
    }));
    const baseline = tenant ? [
      { id: "tenant-created", date: tenant.createdAt, event: "Alta de cliente", detail: `${tenant.name} (${tenant.slug})`, user: "Plataforma" },
      { id: "tenant-modules", date: tenant.updatedAt, event: "Módulos actualizados", detail: `${TENANT_MODULES.filter((module) => !(tenant.disabledModules ?? []).includes(module.id)).length} de ${TENANT_MODULES.length} activos`, user: "Plataforma" },
      ...(tenant.plan ? [{ id: "tenant-plan", date: tenant.updatedAt, event: "Plan asignado", detail: `${tenant.plan.name} · ${money(Number(tenant.plan.monthlyPrice ?? 0))}/mes`, user: "Plataforma" }] : []),
    ] : [];
    return [...extraLogs, ...paymentLogs, ...baseline].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, tenant, extraLogs]);
  const addLog = (event: string, detail: string) => setExtraLogs((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: new Date().toISOString(), event, detail, user: "Admin Plataforma" }, ...prev]);

  const toggleModule = async (moduleId: string) => {
    if (!tenant) return;
    const current = tenant.disabledModules ?? [];
    const next = current.includes(moduleId) ? current.filter((item) => item !== moduleId) : [...current, moduleId];
    setBusy(`module:${moduleId}`);
    try {
      const updated = await tenantApi.update(id, { disabledModules: next });
      setTenant(updated);
      const label = TENANT_MODULES.find((module) => module.id === moduleId)?.label ?? moduleId;
      addLog(next.includes(moduleId) ? "Módulo apagado" : "Módulo activado", label);
      setToast(next.includes(moduleId) ? "Módulo apagado para el cliente." : "Módulo activado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el módulo.");
    } finally {
      setBusy(null);
    }
  };

  const createCharge = async () => {
    if (!Number(form.amount)) return;
    setBusy("charge");
    try {
      await tenantApi.createPayment(id, { concept: form.concept, period: form.period, amount: Number(form.amount), dueDate: form.dueDate });
      addLog("Cargo registrado", `${form.concept} · ${form.period} · ${money(Number(form.amount))}`);
      setToast("Cargo registrado.");
      setChargeOpen(false);
      setForm((prev) => ({ ...prev, amount: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el cargo.");
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (payment: TenantPayment) => {
    setBusy(payment.id);
    try {
      await tenantApi.updatePayment(id, payment.id, { status: "PAID", paidAt: new Date().toISOString() });
      addLog("Pago registrado", `${payment.concept} · ${payment.period} · ${money(payment.amount)}`);
      setToast("Pago registrado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el pago.");
    } finally {
      setBusy(null);
    }
  };

  const filteredModules = useMemo(
    () => TENANT_MODULES.filter((module) => `${module.label} ${module.description}`.toLowerCase().includes(search.toLowerCase())),
    [search]
  );
  const groups = ["Operación", "Nómina y cumplimiento", "Administración"] as const;
  const moduleList = (modules: TenantModuleDefinition[]) => (
    <div className="flex flex-col">
      {groups.map((group) => {
        const rows = modules.filter((module) => module.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="border-t border-slate-100 py-3 first:border-t-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.10em] text-slate-400">{group}</span>
              <span className="text-[11px] text-slate-400">{rows.filter((module) => !disabled.includes(module.id)).length} de {rows.length} activos</span>
            </div>
            <div className="flex flex-col">
              {rows.map((module) => {
                const active = !disabled.includes(module.id);
                const requirementOff = module.requires && disabled.includes(TENANT_MODULES.find((item) => item.label.startsWith(module.requires!))?.id ?? "");
                return (
                  <div key={module.id}>
                    <div className="flex items-center gap-3 py-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold ${TONE[module.tone]}`}>{module.initials}</span>
                      <div className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <ITText className="!text-[13px] font-semibold text-slate-800">{module.label}</ITText>
                          {module.requires && <ITBadget color="gray" size="sm">requiere {module.requires}</ITBadget>}
                        </span>
                        <ITText muted className="mt-0.5 line-clamp-1 !text-[11.5px]">{module.description}</ITText>
                      </div>
                      <ITText className="shrink-0 !text-[11px] font-semibold text-slate-500">{active ? "Activo" : "Apagado"}</ITText>
                      <ITSlideToggle size="sm" isOn={active} disabled={busy === `module:${module.id}`} onToggle={() => void toggleModule(module.id)} label={module.label} />
                    </div>
                    {!active && (
                      <div className="mb-1 flex items-center gap-2 rounded-lg bg-amber-50/70 px-3 py-1.5 text-[11.5px] text-amber-800">
                        <LuCheck size={12} className="rotate-45" /> Apagado. Los {tenant?.usage.activeUsers ?? 0} usuarios ya no ven {module.label} en su menú.
                      </div>
                    )}
                    {active && requirementOff && (
                      <div className="mb-1 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">Este módulo requiere que Asistencia esté activo para funcionar completo.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const sidePanel = tenant && (
    <div className="flex flex-col gap-4">
      <Padre title="Cuenta" icon={<LuWallet size={16} />}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div><ITText muted className="!text-[10.5px] uppercase tracking-wide">Plan</ITText><ITText className="block !text-[15px] font-bold">{tenant.plan?.name ?? "Sin plan"}</ITText></div>
          <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setPlanOpen(true)}>Asignar</ITButton>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 py-2">
          <div><ITText muted className="!text-[10.5px] uppercase tracking-wide">Personas activas</ITText><ITText className="block !text-[15px] font-bold">{tenant.usage.activeUsers} {tenant.limits.people ? `/ ${tenant.limits.people}` : "/ sin límite"}</ITText></div>
          <ITBadget color="info" size="sm">Uso</ITBadget>
        </div>
        <div className="grid grid-cols-2 gap-2 py-2">
          <div><ITText muted className="!text-[10.5px] uppercase tracking-wide">Pagado</ITText><ITText className="block !text-[15px] font-bold">{money(payments?.summary.paid ?? 0)}</ITText></div>
          <div><ITText muted className="!text-[10.5px] uppercase tracking-wide">Por cobrar</ITText><ITText className="block !text-[15px] font-bold">{money(payments?.summary.pending ?? 0)}</ITText></div>
        </div>
        <ITButton variant="outlined" color="primary" size="sm" className="tm-row-button mt-1 w-full" onClick={() => setChargeOpen(true)}><LuPlus size={13} className="mr-1" /> Registrar cargo</ITButton>
      </Padre>

      <Padre title="Últimos movimientos" icon={<LuCreditCard size={16} />} action={<ITButton variant="text" color="primary" size="sm" onClick={() => setTab("billing")}>Ver kardex</ITButton>}>
        {(payments?.rows.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-[12px] text-slate-500">Aún no hay cargos ni pagos.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {payments!.rows.slice(0, 3).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 text-[12.5px]">
                <div><ITText className="block font-semibold !text-[12.5px]">{payment.concept}</ITText><ITText muted className="!text-[11px]">{payment.period} · {dateLabel(payment.dueDate)}</ITText></div>
                <div className="text-right"><ITText className="block font-bold !text-[12.5px]">{money(payment.amount)}</ITText><ITBadget color={STATUS[payment.status].color} size="sm">{STATUS[payment.status].label}</ITBadget></div>
              </div>
            ))}
          </div>
        )}
      </Padre>

    </div>
  );

  return (
    <ITPage
      title={tenant?.name ?? "Detalle del cliente"}
      description={tenant ? `${tenantHost(tenant.slug)} · ${tenant.status === "ACTIVE" ? "Activo" : "Suspendido"}${tenant.createdAt ? ` · alta ${dateLabel(tenant.createdAt)}` : ""}` : "Cliente"}
      icon={<LuBuilding2 size={20} />}
      backAction={() => navigate("/tenants")}
      actions={tenant ? (
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <ITButton variant="outlined" color="secondary" className="tm-row-button" onClick={() => setEditOpen(true)}>
              <span className="inline-flex items-center gap-1.5"><LuPencil size={13} /> Editar</span>
            </ITButton>
          )}
          <ITButton variant="outlined" color="secondary" className="tm-row-button" title="Operar los relojes del cliente: alta, probar conexión y sincronizar" disabled={tenant.status !== "ACTIVE"} onClick={() => void actions.enter(tenant, "/#/time-clocks")}>
            <span className="inline-flex items-center gap-1.5"><LuClock3 size={13} /> Relojes</span>
          </ITButton>
          <ITButton variant="outlined" color="secondary" className="tm-row-button" title="Token del agente que conecta los relojes del cliente" onClick={() => setAgentOpen(true)}>
            <span className="inline-flex items-center gap-1.5"><LuKeyRound size={13} /> Agente del reloj</span>
          </ITButton>
          <ITButton variant="outlined" color="secondary" className="tm-row-button" title="Abrir el login del cliente en otra pestaña" onClick={() => window.open(tenantUrl(tenant.slug), "_blank", "noopener")}>
            <span className="inline-flex items-center gap-1.5"><LuExternalLink size={13} /> Abrir sitio</span>
          </ITButton>
          {canManage && (
            <ITButton variant="outlined" color={tenant.status === "ACTIVE" ? "warning" : "success"} className="tm-row-button" onClick={() => actions.setStatusTarget(tenant)}>
              <span className="inline-flex items-center gap-1.5">{tenant.status === "ACTIVE" ? <><LuPause size={13} /> Suspender</> : <><LuPlay size={13} /> Reactivar</>}</span>
            </ITButton>
          )}
          <ITButton variant="filled" color="primary" className="tm-row-button" title="Operar las pantallas del cliente como soporte (queda en auditoría)" disabled={tenant.status !== "ACTIVE"} onClick={() => void actions.enter(tenant)}>
            <span className="inline-flex items-center gap-1.5"><LuLogIn size={13} /> Entrar como soporte</span>
          </ITButton>
        </div>
      ) : undefined}
    >
      {!tenant || !payments ? (
        error ? <ITAlert variant="error">{error}</ITAlert> : <ITText muted>Cargando cliente…</ITText>
      ) : (
        <div className="flex flex-col gap-4">
          {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}
          {actions.error && <ITAlert variant="error" dismissible onDismiss={() => actions.setError(null)}>{actions.error}</ITAlert>}
          <TabBar
            items={[
              { id: "summary", label: "Resumen" },
              { id: "modules", label: `Módulos ${activeModules.length}/${TENANT_MODULES.length}` },
              { id: "billing", label: "Facturación" },
              { id: "activity", label: "Actividad" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {setupDone < setup.length && (
            <ITCard contentClassName="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <ITText className="font-bold">Termina de configurar este cliente</ITText>
                  <ITText muted className="!text-[12px]">Faltan {setup.length - setupDone} pasos para empezar a operar.</ITText>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(setupDone / setup.length) * 100}%` }} /></div>
                  <span className="text-[11.5px] font-semibold text-slate-500">{setupDone} de {setup.length}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {setup.map((step) => (
                  <button key={step.id} type="button" onClick={step.action} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50">
                    {step.done ? <LuCheck size={16} className="shrink-0 text-emerald-600" /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />}
                    <div className="min-w-0 flex-1"><ITText className="block !text-[12.5px] font-semibold text-slate-800">{step.label}</ITText><ITText muted className="line-clamp-1 !text-[10.5px]">{step.caption}</ITText></div>
                    {!step.done && <LuChevronRight size={14} className="text-slate-400" />}
                  </button>
                ))}
              </div>
            </ITCard>
          )}

          {tab === "summary" && (
            <div className="grid items-start gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Padre title="Resumen de módulos" icon={<LuBuilding2 size={16} />} action={<ITButton variant="outlined" color="primary" size="sm" className="tm-row-button" onClick={() => setTab("modules")}>Gestionar módulos</ITButton>}>
                  <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    {groups.map((group) => {
                      const rows = TENANT_MODULES.filter((module) => module.group === group);
                      const active = rows.filter((module) => !disabled.includes(module.id)).length;
                      return (
                        <button key={group} type="button" onClick={() => setTab("modules")} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-left transition hover:bg-slate-50">
                          <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{group}</span>
                          <span className="mt-1 block text-[22px] font-black tabular-nums text-slate-900">{active}<span className="text-[13px] font-semibold text-slate-400"> / {rows.length}</span></span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200/70"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(active / rows.length) * 100}%` }} /></span>
                          <span className="mt-1 block text-[11px] text-slate-500">módulos activos</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {disabled.length === 0 ? (
                      <div className="rounded-xl bg-emerald-50/70 px-3 py-2 text-[12px] text-emerald-800">Todos los módulos están activos para este cliente.</div>
                    ) : (
                      <>
                        <ITText className="!text-[11px] font-semibold uppercase tracking-wide text-slate-400">Apagados</ITText>
                        {TENANT_MODULES.filter((module) => disabled.includes(module.id)).map((module) => (
                          <div key={module.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/70 px-3 py-2">
                            <span className="text-[12.5px] font-semibold text-amber-900">{module.label}</span>
                            <ITButton variant="text" color="primary" size="sm" onClick={() => void toggleModule(module.id)}>Activar</ITButton>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </Padre>
                <div className="mt-4">
                  <Padre title="Actividad reciente" icon={<LuClock size={16} />} action={<ITButton variant="text" color="primary" size="sm" onClick={() => setTab("activity")}>Ver todo</ITButton>}>
                    <ITTable
                      columns={logColumns as unknown as Column<Record<string, unknown>>[]}
                      data={logs.slice(0, 6) as unknown as Record<string, unknown>[]}
                      size="sm"
                      density="compact"
                      layout="fixed"
                      showVerticalBorder={false}
                      showViewToggle={false}
                      defaultItemsPerPage={5}
                      itemsPerPageOptions={[5, 10, 25]}
                      virtualized
                      virtualizedMaxHeight={240}
                      rowHeight={44}
                    />
                  </Padre>
                </div>
              </div>
              <div className="lg:col-span-4">{sidePanel}</div>
            </div>
          )}

          {tab === "modules" && (
            <div className="grid items-start gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Padre title="Módulos y pantallas" icon={<LuBuilding2 size={16} />} action={<div className="flex items-center gap-2"><div className="w-52"><ITInput name="moduleSearch" size="sm" placeholder="Buscar módulo" value={search} onChange={(event) => setSearch(event.target.value)} iconLeft={<LuSearch size={12} />} /></div><span className="text-[11px] text-slate-500">{activeModules.length}/{TENANT_MODULES.length}</span></div>}>
                  {moduleList(filteredModules)}
                </Padre>
              </div>
              <div className="lg:col-span-4">{sidePanel}</div>
            </div>
          )}

          {tab === "billing" && (
            <div className="grid items-start gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Padre title="Kardex de pagos" icon={<LuWallet size={16} />} action={<ITButton variant="filled" color="primary" size="sm" className="tm-row-button" onClick={() => setChargeOpen(true)}><LuPlus size={13} className="mr-1" /> Registrar cargo</ITButton>}>
                  <div className="overflow-x-auto">
                    <div className="min-w-[620px]">
                      <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.9fr_auto] gap-2 border-b border-slate-100 pb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400"><span>Concepto</span><span>Periodo</span><span>Monto</span><span>Vence</span><span>Estado</span><span /></div>
                      {payments.rows.map((payment) => (
                        <div key={payment.id} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.9fr_auto] items-center gap-2 border-b border-slate-50 py-2.5 text-[12.5px] last:border-0">
                          <span className="font-semibold text-slate-800">{payment.concept}</span><span className="text-slate-500">{payment.period}</span><span className="font-semibold tabular-nums">{money(payment.amount)}</span><span className="text-slate-500">{dateLabel(payment.dueDate)}</span><span><ITBadget color={STATUS[payment.status].color} size="sm">{STATUS[payment.status].label}</ITBadget></span>
                          <span className="flex justify-end">{payment.status !== "PAID" && payment.status !== "CANCELLED" && <ITButton variant="outlined" color="success" className="tm-icon-button" aria-label="Registrar pago" title="Registrar pago" disabled={busy === payment.id} onClick={() => void markPaid(payment)}><LuCheck size={14} /></ITButton>}</span>
                        </div>
                      ))}
                      {payments.rows.length === 0 && <ITText muted className="block py-6 text-center !text-[12.5px]">Sin movimientos en el kardex.</ITText>}
                    </div>
                  </div>
                </Padre>
              </div>
              <div className="lg:col-span-4">{sidePanel}</div>
            </div>
          )}

          {tab === "activity" && (
            <div className="grid items-start gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Padre title="Actividad" icon={<LuClock size={16} />}>
                  <div className="flex flex-col gap-3">
                    {payments.rows.slice(0, 8).map((payment) => (
                      <div key={payment.id} className="flex gap-3 border-b border-slate-50 pb-2 text-[12.5px]">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${payment.status === "PAID" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <div className="min-w-0 flex-1"><ITText className="block font-semibold !text-[12.5px]">{payment.concept} · {money(payment.amount)}</ITText><ITText muted className="!text-[11px]">{payment.status === "PAID" ? "Pago registrado" : "Cargo pendiente"} · {dateLabel(payment.paidAt ?? payment.dueDate)}</ITText></div>
                        <ITBadget color={STATUS[payment.status].color} size="sm">{STATUS[payment.status].label}</ITBadget>
                      </div>
                    ))}
                    <div className="flex gap-3 text-[12.5px]"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" /><div><ITText className="block font-semibold !text-[12.5px]">Cliente creado</ITText><ITText muted className="!text-[11px]">{dateLabel(tenant.createdAt)}</ITText></div></div>
                    {payments.rows.length === 0 && <ITText muted className="!text-[12px]">Sin actividad registrada.</ITText>}
                  </div>
                </Padre>
              </div>
              <div className="lg:col-span-4">{sidePanel}</div>
            </div>
          )}
        </div>
      )}

      <PlanAssignDialog isOpen={planOpen} tenant={tenant} onClose={() => setPlanOpen(false)} onSaved={load} />
      <TenantEditDialog
        isOpen={editOpen}
        tenant={tenant}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          const slugChanged = updated.slug !== tenant?.slug;
          setTenant(updated);
          const selected = getSelectedTenant();
          if (selected?.id === updated.id) setSelectedTenant({ ...selected, name: updated.name, slug: updated.slug });
          setToast(slugChanged ? `Cliente guardado. Nueva entrada: ${tenantHost(updated.slug)}` : "Cliente guardado.");
        }}
      />
      <AgentTokenDialog isOpen={agentOpen} tenant={tenant} onClose={() => setAgentOpen(false)} />
      <TicConfirm
        isOpen={!!actions.statusTarget}
        onClose={() => actions.setStatusTarget(null)}
        onConfirm={() => void actions.confirmStatus()}
        loading={actions.savingStatus}
        variant={actions.statusTarget?.status === "ACTIVE" ? "danger" : "success"}
        title={actions.statusTarget ? t(actions.statusTarget.status === "ACTIVE" ? "platform.confirm.suspendTitle" : "platform.confirm.reactivateTitle", { name: actions.statusTarget.name }) : undefined}
        message={actions.statusTarget ? t(actions.statusTarget.status === "ACTIVE" ? "platform.confirm.suspendMessage" : "platform.confirm.reactivateMessage", { host: tenantHost(actions.statusTarget.slug) }) : undefined}
        confirmLabel={t(actions.statusTarget?.status === "ACTIVE" ? "platform.confirm.suspend" : "platform.confirm.reactivate")}
      />
      <ITDialog isOpen={chargeOpen} onClose={() => setChargeOpen(false)} title="Registrar cargo">
        <div className="flex flex-col gap-3">
          <ITInput name="payConcept" label="Concepto" value={form.concept} onChange={(event) => setForm((prev) => ({ ...prev, concept: event.target.value }))} />
          <ITInput name="payPeriod" label="Periodo (YYYY-MM)" value={form.period} onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value }))} />
          <ITInput name="payAmount" label="Monto (MXN)" type="number" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
          <ITDatePicker name="payDue" label="Vence" value={dateStrToLocal(form.dueDate)} onChange={(event) => { const value = event.target.value; if (value instanceof Date) setForm((prev) => ({ ...prev, dueDate: localToDateStr(value) })); }} />
          <div className="flex justify-end gap-2"><ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setChargeOpen(false)}>Cancelar</ITButton><ITButton variant="filled" color="primary" size="sm" className="tm-row-button" disabled={busy === "charge"} onClick={() => void createCharge()}>Registrar</ITButton></div>
        </div>
      </ITDialog>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}

function Padre({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <ITCard contentClassName="!p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-slate-500">{icon}<ITText className="!text-[14px] font-bold !text-slate-800">{title}</ITText></div>{action}</div>
      {children}
    </ITCard>
  );
}
