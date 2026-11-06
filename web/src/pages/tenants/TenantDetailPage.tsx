import { useCallback, useEffect, useMemo, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITInput, ITPage, ITText, ITToast, ITDatePicker } from "@axzydev/axzy_ui_system";
import { LuArrowLeft, LuBuilding2, LuCalendarClock, LuCheck, LuChevronLeft, LuChevronRight, LuClock, LuLock, LuLockOpen, LuWallet } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { tenantApi } from "@entities/tenant";
import { TENANT_MODULES } from "@shared/lib/tenant-modules";
import type { Tenant, TenantPayment, TenantPaymentStatus, TenantPayments } from "@entities/tenant";

const dateStrToLocal = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};
const localToDateStr = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const STATUS: Record<TenantPaymentStatus, { label: string; color: "success" | "warning" | "danger" | "gray" }> = {
  PAID: { label: "Pagado", color: "success" },
  PENDING: { label: "Pendiente", color: "warning" },
  OVERDUE: { label: "Vencido", color: "danger" },
  CANCELLED: { label: "Cancelado", color: "gray" },
};

/** Detalle del cliente para plataforma: uso, plan y kardex de pagos. */
export default function TenantDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [payments, setPayments] = useState<TenantPayments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    concept: "Suscripción mensual",
    period: new Date().toISOString().slice(0, 7),
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
  });
  const pageSize = 8;

  const load = useCallback(async () => {
    try {
      const [nextTenant, nextPayments] = await Promise.all([tenantApi.get(id), tenantApi.payments(id)]);
      setTenant(nextTenant);
      setPayments(nextPayments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el cliente.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil((payments?.rows.length ?? 0) / pageSize));
  const visible = useMemo(
    () => (payments?.rows ?? []).slice((page - 1) * pageSize, page * pageSize),
    [payments, page]
  );

  const create = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setBusy("create");
    try {
      await tenantApi.createPayment(id, {
        concept: form.concept,
        period: form.period,
        amount: Number(form.amount),
        dueDate: form.dueDate,
      });
      setToast("Cargo registrado en el kardex.");
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
      await tenantApi.updatePayment(id, payment.id, {
        status: "PAID",
        paidAt: new Date().toISOString(),
      });
      setToast("Pago registrado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el pago.");
    } finally {
      setBusy(null);
    }
  };

  const toggleModule = async (moduleId: string) => {
    if (!tenant) return;
    const current = tenant.disabledModules ?? [];
    const next = current.includes(moduleId) ? current.filter((id) => id !== moduleId) : [...current, moduleId];
    setBusy(`module:${moduleId}`);
    try {
      const updated = await tenantApi.update(id, { disabledModules: next });
      setTenant(updated);
      setToast(next.includes(moduleId) ? "Módulo apagado para el cliente." : "Módulo activado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el módulo.");
    } finally {
      setBusy(null);
    }
  };

  if (!tenant || !payments) {
    return (
      <ITPage title="Cliente" icon={<LuBuilding2 size={20} />} maxWidth="7xl">
        {error ? <ITAlert variant="error">{error}</ITAlert> : <ITText muted>Cargando cliente…</ITText>}
      </ITPage>
    );
  }

  const planPrice = Number(tenant.plan?.monthlyPrice ?? 0);
  const wave = (color: string) => (
    <svg aria-hidden viewBox="0 0 600 70" preserveAspectRatio="none" className="dash-waves pointer-events-none absolute inset-x-0 bottom-0 h-[54px] w-[200%]">
      <path d="M0,42 C90,14 150,62 240,40 C330,18 390,60 480,36 C540,24 570,30 600,42 L600,70 L0,70 Z" fill={color} />
      <path d="M0,52 C100,30 160,66 260,48 C360,28 420,62 520,44 C560,38 580,42 600,52 L600,70 L0,70 Z" fill={color} opacity="0.5" />
    </svg>
  );

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title="Detalle del cliente"
      description={`${tenant.slug} · ${tenant.status === "ACTIVE" ? "Cliente activo" : "Cliente suspendido"}`}
      icon={<LuBuilding2 size={20} />}
      actions={
        <ITButton variant="outlined" color="secondary" className="tm-save-button" onClick={() => navigate("/")}>
          <LuArrowLeft size={14} className="mr-1" /> Volver
        </ITButton>
      }
    >
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}

        <ITCard contentClassName="!p-0">
          <div className="relative overflow-hidden tm-hero-card rounded-2xl px-5 py-4 text-slate-900">
            {wave("rgba(255,255,255,0.10)")}
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div>
                <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-slate-500">Cliente</ITText>
                <ITText className="!text-2xl font-extrabold !text-slate-900">{tenant.name}</ITText>
                <ITText className="!text-[12px] !text-slate-600">{tenant.slug} · {tenant.status === "ACTIVE" ? "Activo" : "Suspendido"} · alta {dateLabel(tenant.createdAt)}</ITText>
              </div>
              <div className="flex flex-wrap gap-2 text-[11.5px]">
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/85">{tenant.plan?.name ?? "Sin plan"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/85">{tenant.usage.activeUsers} / {tenant.limits.people ?? "—"} personas</span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/85">{tenant.usage.clocks} / {tenant.limits.clocks ?? "—"} relojes</span>
              </div>
            </div>
          </div>
        </ITCard>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {[
            { label: "Plan", value: tenant.plan?.name ?? "Sin plan", caption: planPrice ? `${money(planPrice)} / mes` : "Sin precio", color: "rgba(15,46,61,0.10)", icon: <LuWallet size={13} /> },
            { label: "Personas", value: `${tenant.usage.activeUsers} / ${tenant.limits.people ?? "—"}`, caption: "activas / límite", color: "rgba(16,185,129,0.14)", icon: <LuBuilding2 size={13} /> },
            { label: "Pagado", value: money(payments.summary.paid), caption: "histórico", color: "rgba(14,165,233,0.12)", icon: <LuCheck size={13} /> },
            { label: "Por cobrar", value: money(payments.summary.pending), caption: "pendiente / vencido", color: "rgba(245,158,11,0.16)", icon: <LuCalendarClock size={13} /> },
          ].map((kpi) => (
            <div key={kpi.label} className="dash-kpi dash-card relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" style={{ borderColor: "#eef1f5" }}>
              {wave(kpi.color)}
              <span className="relative flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{kpi.icon} {kpi.label}</span>
              <span className="relative mt-1 block !text-[24px] font-black tabular-nums text-slate-900">{kpi.value}</span>
              <span className="relative text-[11.5px] text-slate-500">{kpi.caption}</span>
            </div>
          ))}
        </div>

        <ITCard contentClassName="!p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <ITText className="font-bold">Módulos y pantallas del cliente</ITText>
              <ITText muted className="mt-1 block !text-[11.5px]">Apaga un módulo para ocultar sus pantallas y bloquear la ruta a los usuarios del cliente.</ITText>
            </div>
            <ITText muted className="!text-[11.5px]">{TENANT_MODULES.filter((module) => !(tenant.disabledModules ?? []).includes(module.id)).length} activos de {TENANT_MODULES.length}</ITText>
          </div>
          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {TENANT_MODULES.map((module) => {
              const active = !(tenant.disabledModules ?? []).includes(module.id);
              return (
                <div key={module.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-800">
                      {active ? <LuLockOpen size={13} className="text-emerald-600" /> : <LuLock size={13} className="text-slate-400" />}
                      {module.label}
                    </span>
                    <ITText muted className="mt-0.5 line-clamp-1 block !text-[10.5px]">{module.description}</ITText>
                  </div>
                  <ITBadget color={active ? "success" : "gray"} size="sm">{active ? "Activo" : "Apagado"}</ITBadget>
                  <ITButton
                    variant="outlined"
                    color={active ? "secondary" : "success"}
                    size="sm"
                    className="tm-row-button shrink-0"
                    disabled={busy === `module:${module.id}`}
                    onClick={() => void toggleModule(module.id)}
                  >
                    {active ? "Apagar" : "Activar"}
                  </ITButton>
                </div>
              );
            })}
          </div>
        </ITCard>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <ITCard className="lg:col-span-8" contentClassName="!p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LuWallet size={16} className="text-slate-500" />
                <ITText className="font-bold">Kardex de pagos</ITText>
              </div>
              <ITText muted className="!text-[11.5px]">{payments.rows.length} movimientos</ITText>
            </div>

            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.8fr_auto] gap-2 border-b border-slate-100 pb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Concepto</span><span>Periodo</span><span>Monto</span><span>Vence</span><span>Estado</span><span />
                </div>
                {visible.map((payment) => (
                  <div key={payment.id} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.8fr_auto] items-center gap-2 border-b border-slate-50 py-2.5 text-[12.5px] transition hover:bg-slate-50/70 last:border-0">
                    <span className="font-semibold text-slate-800">{payment.concept}</span>
                    <span className="text-slate-500">{payment.period}</span>
                    <span className="font-semibold tabular-nums">{money(payment.amount)}</span>
                    <span className="text-slate-500">{dateLabel(payment.dueDate)}</span>
                    <span><ITBadget color={STATUS[payment.status].color} size="sm">{STATUS[payment.status].label}</ITBadget></span>
                    <span className="flex justify-end">
                      {payment.status !== "PAID" && payment.status !== "CANCELLED" && (
                        <ITButton
                          variant="outlined"
                          color="success"
                          size="sm"
                          className="tm-icon-button"
                          aria-label="Registrar pago"
                          title="Registrar pago"
                          disabled={busy === payment.id}
                          onClick={() => void markPaid(payment)}
                        >
                          <LuCheck size={14} />
                        </ITButton>
                      )}
                    </span>
                  </div>
                ))}
                {payments.rows.length === 0 && <ITText muted className="block py-6 text-center !text-[12.5px]">Sin movimientos en el kardex.</ITText>}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <ITText muted className="!text-[11.5px]">
                {payments.rows.length === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, payments.rows.length)}`} de {payments.rows.length}
              </ITText>
              <div className="flex gap-1">
                <ITButton variant="outlined" color="secondary" className="tm-icon-button" aria-label="Anterior" title="Anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <LuChevronLeft size={15} />
                </ITButton>
                <ITButton variant="outlined" color="secondary" className="tm-icon-button" aria-label="Siguiente" title="Siguiente" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  <LuChevronRight size={15} />
                </ITButton>
              </div>
            </div>
          </ITCard>

          <ITCard className="lg:col-span-4" contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <LuClock size={16} className="text-slate-500" />
              <ITText className="font-bold">Registrar cargo</ITText>
            </div>
            <ITText muted className="mt-1 block !text-[11.5px]">Cargo manual o estimado para el kardex; no genera CFDI.</ITText>
            <div className="mt-3 flex flex-col gap-2">
              <ITInput name="concept" label="Concepto" value={form.concept} onChange={(e) => setForm((p) => ({ ...p, concept: e.target.value }))} />
              <ITInput name="period" label="Periodo (YYYY-MM)" value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))} />
              <ITInput name="amount" label="Monto (MXN)" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              <ITDatePicker
                name="paymentDueDate"
                label="Vence"
                value={dateStrToLocal(form.dueDate)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value instanceof Date) setForm((prev) => ({ ...prev, dueDate: localToDateStr(value) }));
                }}
              />
              <ITButton variant="filled" color="primary" className="tm-save-button mt-1 w-full" disabled={busy === "create"} onClick={() => void create()}>
                Registrar cargo
              </ITButton>
            </div>
          </ITCard>
        </div>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
