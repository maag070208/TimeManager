import { useCallback, useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITDataTable, ITText, ITToast, type Column, type ITDataTableFetchParams, type ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { LuCalendarCheck, LuCheck, LuX } from "react-icons/lu";
import { nomApi } from "@entities/nom";
import type { LeaveRequestRow } from "@entities/nom";
import { HelpTip } from "@shared/ui/help-tip";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { TicState } from "@shared/ui/tic";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeaveRequestRow["status"]>("ALL");

  const load = useCallback(async () => {
    try {
      setRequests(await nomApi.leaveRequests());
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

  const pending = requests.filter((row) => row.status === "PENDING");
  const approved = requests.filter((row) => row.status === "APPROVED").length;
  const rejected = requests.filter((row) => row.status === "REJECTED").length;
  const history = statusFilter === "ALL" ? requests : requests.filter((row) => row.status === statusFilter);

  const historyColumns: Column<LeaveRequestRow>[] = [
    {
      key: "user",
      label: "Empleado",
      type: "string",
      render: (row) => (
        <div className="min-w-0">
          <ITText className="block truncate font-semibold !text-[12px]">{row.user?.name ?? "—"}</ITText>
          <ITText muted className="block truncate !text-[11px]">{row.type.name}</ITText>
        </div>
      ),
    },
    {
      key: "startDate",
      label: "Periodo",
      type: "string",
      render: (row) => <span className="text-[12px] text-slate-600">{dateLabel(row.startDate)} – {dateLabel(row.endDate)}</span>,
    },
    { key: "days", label: "Días", type: "number", width: 90, render: (row) => <span className="tabular-nums text-[12px]">{row.days}</span> },
    {
      key: "paid",
      label: "Goce",
      type: "string",
      width: 140,
      render: (row) => <ITBadget color={row.type.paid ? "success" : "gray"} size="sm">{row.type.paid ? "Con goce" : "Sin goce"}</ITBadget>,
    },
    {
      key: "status",
      label: "Estado",
      type: "string",
      width: 130,
      render: (row) => <ITBadget color={STATUS[row.status].color} size="sm">{STATUS[row.status].label}</ITBadget>,
    },
  ];

  const fetchHistory = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<LeaveRequestRow>> => {
    const start = (params.page - 1) * params.limit;
    return { data: history.slice(start, start + params.limit), total: history.length };
  };

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title="Vacaciones y permisos"
      description="Solicitudes de vacaciones y permisos del personal del cliente."
      icon={<LuCalendarCheck size={20} />}
    >
      <div className="grid items-start gap-4 pb-12 lg:grid-cols-12">
        {error && (
          <div className="lg:col-span-12">
            <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>
          </div>
        )}

        <div className="lg:col-span-12">
          <BentoFilterCards
            activeId={statusFilter}
            onSelect={(id: string) => setStatusFilter(id as "ALL" | LeaveRequestRow["status"])}
            items={[
              { id: "ALL", label: "Todas", value: requests.length },
              { id: "PENDING", label: "Pendientes", value: pending.length },
              { id: "APPROVED", label: "Aprobadas", value: approved },
              { id: "REJECTED", label: "Rechazadas", value: rejected },
            ]}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-12">
          <ITCard className="tm-hero-card tm-hero-card--amber" contentClassName="!p-5">
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
                <TicState kind="empty" size="sm" title="Sin solicitudes pendientes" description="Cuando alguien solicite vacaciones o un permiso aparecerá aquí para decidir." />
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

          <ITCard className="tm-hero-card tm-hero-card--sky" contentClassName="!p-5">
            <div className="flex items-center gap-2">
              <ITText className="font-bold">Historial</ITText>
              <HelpTip text="Todas las solicitudes del cliente con su estado y quién las decidió. La aprobación queda en auditoría para la prenómina y el expediente." />
            </div>
            {requests.length === 0 ? (
              <TicState kind="empty" size="sm" title="Sin historial todavía" description="Las solicitudes aparecerán aquí con su estado y decisión." />
            ) : (
              <div className="mt-3">
                <ITDataTable
                  columns={historyColumns as unknown as Column<Record<string, unknown>>[]}
                  fetchData={fetchHistory as never}
                  showViewToggle={false}
                  defaultItemsPerPage={50}
                  itemsPerPageOptions={[25, 50, 100]}
                  layout="fixed"
                  density="compact"
                  virtualized
                  virtualizedMaxHeight={400}
                  rowHeight={50}
                />
              </div>
            )}
          </ITCard>
        </div>

      </div>
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </ITPage>
  );
}
