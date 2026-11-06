import { useCallback, useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITInput, ITPage, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { LuCalendarCheck, LuCheck, LuX } from "react-icons/lu";
import { nomApi } from "@entities/nom";
import type { LeaveRequestRow, LeaveType } from "@entities/nom";
import { HelpTip } from "@shared/ui/help-tip";

const dateLabel = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const STATUS: Record<LeaveRequestRow["status"], { label: string; color: "success" | "warning" | "danger" | "gray" }> = {
  PENDING: { label: "Pendiente", color: "warning" },
  APPROVED: { label: "Aprobada", color: "success" },
  REJECTED: { label: "Rechazada", color: "danger" },
  CANCELLED: { label: "Cancelada", color: "gray" },
};

/** RH: solicitudes de vacaciones/permisos y tipos configurables. */
export default function LeaveAdminPage() {
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [typeKey, setTypeKey] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typePaid, setTypePaid] = useState("false");

  const load = useCallback(async () => {
    try {
      const [nextRequests, nextTypes] = await Promise.all([nomApi.leaveRequests(), nomApi.leaveTypes()]);
      setRequests(nextRequests);
      setTypes(nextTypes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las solicitudes.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (row: LeaveRequestRow, approve: boolean) => {
    setBusy(row.id);
    try {
      await nomApi.decideLeaveRequest(row.id, { approve, note: approve ? "Autorizado por RH" : "Rechazado por RH" });
      setToast(approve ? "Solicitud aprobada." : "Solicitud rechazada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo decidir.");
    } finally {
      setBusy(null);
    }
  };

  const createType = async () => {
    if (typeKey.trim().length < 3 || typeName.trim().length < 3) return;
    setBusy("type");
    try {
      await nomApi.createType({ key: typeKey, name: typeName, paid: typePaid === "true" });
      setToast("Tipo de permiso creado.");
      setTypeKey("");
      setTypeName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el tipo.");
    } finally {
      setBusy(null);
    }
  };

  const pending = requests.filter((row) => row.status === "PENDING");
  const approved = requests.filter((row) => row.status === "APPROVED").length;
  const rejected = requests.filter((row) => row.status === "REJECTED").length;

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title="Vacaciones y permisos"
      description="Solicitudes del personal, saldos y tipos configurables por cliente."
      icon={<LuCalendarCheck size={20} />}
    >
      <div className="grid items-start gap-4 pb-12 lg:grid-cols-12">
        {error && (
          <div className="lg:col-span-12">
            <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:col-span-8">
          <ITCard contentClassName="!p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ITText className="font-bold">Pendientes de aprobar ({pending.length})</ITText>
                <HelpTip text="Solicitudes enviadas por el personal que esperan decisión de RH. Al aprobar se descuentan del saldo de vacaciones; el permiso sin goce no afecta el saldo." />
              </div>
              <ITBadget color={pending.length > 0 ? "warning" : "success"} size="sm">
                {pending.length > 0 ? `${pending.length} por revisar` : "Al día"}
              </ITBadget>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {pending.length === 0 && (
                <ITText muted className="!text-[12.5px]">Sin solicitudes pendientes. Cuando alguien solicite vacaciones aparecerá aquí.</ITText>
              )}
              {pending.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <ITText className="font-semibold !text-[13px]">
                      {row.user?.name ?? "—"} · {row.type.name}
                    </ITText>
                    <ITText muted className="!text-[11.5px]">
                      {dateLabel(row.startDate)} – {dateLabel(row.endDate)} · {row.days} días
                      {row.reason ? ` · ${row.reason}` : ""}
                    </ITText>
                    <ITBadget color={row.type.paid ? "success" : "gray"} size="sm">
                      {row.type.paid ? "Con goce de sueldo" : "Sin goce de sueldo"}
                    </ITBadget>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ITButton variant="filled" color="primary" size="sm" className="tm-save-button" disabled={busy === row.id} onClick={() => void decide(row, true)}>
                      <LuCheck size={13} className="mr-1" /> Aprobar
                    </ITButton>
                    <ITButton variant="outlined" color="secondary" size="sm" className="tm-save-button" disabled={busy === row.id} onClick={() => void decide(row, false)}>
                      <LuX size={13} className="mr-1" /> Rechazar
                    </ITButton>
                  </div>
                </div>
              ))}
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <ITText className="font-bold">Historial</ITText>
              <HelpTip text="Todas las solicitudes del cliente con su estado y quién las decidió. La aprobación queda en auditoría para la prenómina y el expediente." />
            </div>
            <div className="mt-3 flex flex-col divide-y divide-slate-100">
              {requests.length === 0 && <ITText muted className="!text-[12.5px]">Todavía no hay solicitudes.</ITText>}
              {requests.map((row) => (
                <div key={row.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <ITText className="!text-[12.5px] font-semibold">
                      {row.user?.name ?? "—"} · {row.type.name}
                    </ITText>
                    <ITText muted className="!text-[11px]">
                      {dateLabel(row.startDate)} – {dateLabel(row.endDate)} · {row.days} días
                    </ITText>
                  </div>
                  <ITBadget color={STATUS[row.status].color} size="sm">{STATUS[row.status].label}</ITBadget>
                </div>
              ))}
            </div>
          </ITCard>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-4">
          <ITCard contentClassName="!p-0">
            <div className="rounded-2xl bg-[#0f2e3d] px-5 py-4 text-white">
              <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-white/60">Resumen</ITText>
              <ITText className="!text-2xl font-extrabold !text-white">{pending.length} pendientes</ITText>
              <ITText className="!text-[12px] !text-white/70">{approved} aprobadas · {rejected} rechazadas</ITText>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="!text-[10.5px] font-semibold uppercase">Tipos</ITText>
                <ITText className="!text-lg font-extrabold">{types.length}</ITText>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="!text-[10.5px] font-semibold uppercase">Aprobadas</ITText>
                <ITText className="!text-lg font-extrabold">{approved}</ITText>
              </div>
            </div>
          </ITCard>

          <ITCard contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <ITText className="font-bold">Tipos de permiso</ITText>
              <HelpTip text="Define los tipos que puede solicitar el personal. 'Con goce' paga el día; 'sin goce' no. La clave es un identificador interno (mayúsculas y guiones bajos)." />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {types.map((type) => (
                <ITBadget key={type.id} color={type.paid ? "success" : "gray"} size="sm">
                  {type.name} · {type.paid ? "con goce" : "sin goce"}
                </ITBadget>
              ))}
            </div>
            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <ITInput name="typeKey" label="Clave" value={typeKey} onChange={(e) => setTypeKey(e.target.value)} />
              <ITInput name="typeName" label="Nombre" value={typeName} onChange={(e) => setTypeName(e.target.value)} />
              <ITSearchSelect
                name="typePaid"
                label="Goce de sueldo"
                value={typePaid}
                onChange={(e) => setTypePaid(e.target.value)}
                options={[{ value: "false", label: "Sin goce" }, { value: "true", label: "Con goce" }]}
              />
            </div>
            <div className="mt-3">
              <ITButton variant="outlined" color="secondary" className="tm-save-button w-full" onClick={() => void createType()} disabled={busy === "type"}>
                Agregar tipo
              </ITButton>
            </div>
          </ITCard>
        </aside>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
