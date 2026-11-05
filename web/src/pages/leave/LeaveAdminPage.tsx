import { useCallback, useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITInput, ITPage, ITText, ITToast, ITSelect } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck } from "react-icons/lu";
import { nomApi } from "@entities/nom";
import type { LeaveRequestRow, LeaveType } from "@entities/nom";

const dateLabel = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

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

  return (
    <ITPage title="Vacaciones y permisos" description="Solicitudes del personal y tipos configurables." icon={<LuCalendarCheck size={20} />} maxWidth="4xl">
      <div className="flex flex-col gap-4 pb-12">
        {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}
        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Pendientes de aprobar ({pending.length})</ITText>
          <div className="mt-3 flex flex-col gap-2">
            {pending.length === 0 && <ITText muted>Sin solicitudes pendientes.</ITText>}
            {pending.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <ITText className="font-semibold !text-[13px]">{row.user?.name ?? "—"} · {row.type.name}</ITText>
                  <ITText muted className="!text-[12px]">
                    {dateLabel(row.startDate)} – {dateLabel(row.endDate)} · {row.days} días{row.reason ? ` · ${row.reason}` : ""}
                  </ITText>
                </div>
                <div className="flex gap-2">
                  <ITButton variant="filled" color="primary" size="sm" disabled={busy === row.id} onClick={() => void decide(row, true)}>Aprobar</ITButton>
                  <ITButton variant="outlined" color="secondary" size="sm" disabled={busy === row.id} onClick={() => void decide(row, false)}>Rechazar</ITButton>
                </div>
              </div>
            ))}
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Tipos de permiso</ITText>
          <div className="mt-2 flex flex-wrap gap-2">
            {types.map((type) => (
              <ITBadget key={type.id} color={type.paid ? "success" : "gray"} size="sm">
                {type.name}{type.paid ? " · con goce" : " · sin goce"}
              </ITBadget>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <ITInput name="typeKey" label="Clave" value={typeKey} onChange={(e) => setTypeKey(e.target.value)} />
            <ITInput name="typeName" label="Nombre" value={typeName} onChange={(e) => setTypeName(e.target.value)} />
            <ITSelect
              name="typePaid"
              label="Goce de sueldo"
              value={typePaid}
              onChange={(e) => setTypePaid(e.target.value)}
              options={[{ value: "false", label: "Sin goce" }, { value: "true", label: "Con goce" }]}
            />
            <ITButton variant="outlined" color="secondary" onClick={() => void createType()} disabled={busy === "type"}>Agregar</ITButton>
          </div>
        </ITCard>

        <ITCard contentClassName="!p-5">
          <ITText className="font-bold">Historial</ITText>
          <div className="mt-2 flex flex-col gap-1.5">
            {requests.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
                <ITText className="!text-[12.5px]">{row.user?.name ?? "—"} · {row.type.name} · {dateLabel(row.startDate)} – {dateLabel(row.endDate)} ({row.days} d)</ITText>
                <ITBadget color={row.status === "APPROVED" ? "success" : row.status === "REJECTED" ? "danger" : row.status === "PENDING" ? "warning" : "gray"} size="sm">
                  {row.status}
                </ITBadget>
              </div>
            ))}
          </div>
        </ITCard>
      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
