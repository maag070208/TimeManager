import { useCallback, useEffect, useMemo, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITInput, ITPage, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { LuArrowLeft, LuBuilding2, LuCheck, LuWallet } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { tenantApi } from "@entities/tenant";
import type { Tenant, TenantPayment, TenantPaymentStatus, TenantPayments } from "@entities/tenant";

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

  if (!tenant || !payments) {
    return (
      <ITPage title="Cliente" icon={<LuBuilding2 size={20} />} maxWidth="7xl">
        {error ? <ITAlert variant="error">{error}</ITAlert> : <ITText muted>Cargando cliente…</ITText>}
      </ITPage>
    );
  }

  const planPrice = Number(tenant.plan?.monthlyPrice ?? 0);
  const kpis = [
    { label: "Plan", value: tenant.plan?.name ?? "Sin plan", caption: planPrice ? `${money(planPrice)} / mes` : "Sin precio" },
    { label: "Personas", value: `${tenant.usage.activeUsers} / ${tenant.limits.people ?? "—"}`, caption: "activas / límite" },
    { label: "Pagado", value: money(payments.summary.paid), caption: "histórico" },
    { label: "Por cobrar", value: money(payments.summary.pending), caption: "pendiente / vencido" },
  ];

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title={tenant.name}
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

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <ITText muted className="!text-[10.5px] font-semibold uppercase tracking-[0.08em]">{kpi.label}</ITText>
              <ITText className="mt-1 block !text-[24px] font-black tabular-nums">{kpi.value}</ITText>
              <ITText muted className="!text-[11.5px]">{kpi.caption}</ITText>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <ITCard className="lg:col-span-8" contentClassName="!p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LuWallet size={16} className="text-slate-500" />
                <ITText className="font-bold">Kardex de pagos</ITText>
              </div>
              <ITText muted className="!text-[11.5px]">{payments.rows.length} movimientos</ITText>
            </div>

            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.9fr_auto] gap-2 border-b border-slate-100 pb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Concepto</span><span>Periodo</span><span>Monto</span><span>Vence</span><span>Estado</span><span />
                </div>
                {visible.map((payment) => (
                  <div key={payment.id} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_0.9fr_auto] items-center gap-2 border-b border-slate-50 py-2.5 text-[12.5px] last:border-0">
                    <span className="font-semibold text-slate-800">{payment.concept}</span>
                    <span className="text-slate-500">{payment.period}</span>
                    <span className="font-semibold tabular-nums">{money(payment.amount)}</span>
                    <span className="text-slate-500">{dateLabel(payment.dueDate)}</span>
                    <span><ITBadget color={STATUS[payment.status].color} size="sm">{STATUS[payment.status].label}</ITBadget></span>
                    <span>
                      {payment.status !== "PAID" && payment.status !== "CANCELLED" && (
                        <ITButton variant="outlined" color="primary" size="sm" className="tm-save-button" disabled={busy === payment.id} onClick={() => void markPaid(payment)}>
                          <LuCheck size={12} className="mr-1" /> Pagar
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
                <ITButton variant="outlined" color="secondary" size="sm" className="tm-save-button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</ITButton>
                <ITButton variant="outlined" color="secondary" size="sm" className="tm-save-button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Siguiente</ITButton>
              </div>
            </div>
          </ITCard>

          <ITCard className="lg:col-span-4" contentClassName="!p-5">
            <ITText className="font-bold">Registrar cargo</ITText>
            <ITText muted className="mt-1 block !text-[11.5px]">Cargo manual o estimado para el kardex; no genera CFDI.</ITText>
            <div className="mt-3 flex flex-col gap-2">
              <ITInput name="concept" label="Concepto" value={form.concept} onChange={(e) => setForm((p) => ({ ...p, concept: e.target.value }))} />
              <ITInput name="period" label="Periodo (YYYY-MM)" value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))} />
              <ITInput name="amount" label="Monto (MXN)" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              <label className="flex flex-col gap-1 text-[12px] text-slate-600">
                Vence
                <input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="rounded-md border border-slate-200 px-2 py-2 text-[13px]" />
              </label>
              <ITButton variant="filled" color="primary" className="tm-save-button mt-1" disabled={busy === "create"} onClick={() => void create()}>
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
