import { useCallback, useEffect, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITDialog, ITText, ITTextarea } from "@axzydev/axzy_ui_system";
import { LuCheck, LuHistory, LuX } from "react-icons/lu";
import { nomApi, type PunchAdjustment, type PunchHistory } from "@entities/nom";
import { useTenantTimezone } from "@entities/user";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { DialogHeader } from "@shared/ui/dialog-header";
import { TicState } from "@shared/ui/tic";

const STATUS: Record<PunchAdjustment["status"], { label: string; color: "warning" | "success" | "danger" }> = {
  PENDING: { label: "Por revisar", color: "warning" },
  APPROVED: { label: "Aprobada", color: "success" },
  REJECTED: { label: "Rechazada", color: "danger" },
};

const AUDIT_LABEL: Record<string, string> = {
  REMOTE_PUNCH_RECORDED: "Checada registrada",
  PUNCH_ADJUSTMENT_REQUESTED: "Corrección solicitada",
  PUNCH_ADJUSTMENT_APPROVED: "Corrección aprobada",
  PUNCH_ADJUSTMENT_REJECTED: "Corrección rechazada",
  PUNCH_DISCREPANCY_REPORTED: "Discrepancia reportada",
};

interface Props {
  /** Avisa cuántas correcciones siguen pendientes (contador de la pestaña). */
  onPendingChange?: (count: number) => void;
  onDone: (message: string) => void;
}

/**
 * Correcciones de checadas para RH: lo que reportó el personal, aprobar o
 * rechazar con nota, y el historial de cada checada (original inmutable,
 * valor vigente y bitácora).
 */
export const PunchCorrections = ({ onPendingChange, onDone }: Props) => {
  const timezone = useTenantTimezone();
  const when = (iso: unknown) =>
    typeof iso === "string"
      ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone })
      : "—";
  const [rows, setRows] = useState<PunchAdjustment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<PunchHistory | "loading" | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await nomApi.adjustments();
      setRows(next);
      onPendingChange?.(next.filter((row) => row.status === "PENDING").length);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las correcciones.");
    }
  }, [onPendingChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (row: PunchAdjustment, approve: boolean) => {
    setBusy(row.id);
    setError(null);
    try {
      await nomApi.decideAdjustment(row.id, approve, note.trim() || undefined);
      setRejecting(null);
      setNote("");
      onDone(approve ? "Corrección aprobada." : "Corrección rechazada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la decisión.");
    } finally {
      setBusy(null);
    }
  };

  const openHistory = async (punchId: string) => {
    setHistory("loading");
    try {
      setHistory(await nomApi.punchHistory(punchId));
    } catch (cause) {
      setHistory(null);
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
    }
  };

  if (rows === null) return <ContentSkeleton />;

  return (
    <>
      <ITAlert variant="info">
        La checada original nunca se modifica. Una corrección aprobada cambia la hora que cuenta para la jornada y queda
        registrado quién la pidió, quién la aprobó y por qué.
      </ITAlert>
      {error && <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>{error}</ITAlert>}
      {rows.length === 0 ? (
        <ITCard contentClassName="!p-5">
          <TicState kind="empty" size="sm" title="Sin correcciones" description="Cuando alguien reporte que una checada no coincide, aparecerá aquí." />
        </ITCard>
      ) : (
        <ITCard className="tm-hero-card tm-hero-card--sky" contentClassName="!p-5">
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const before = row.previousState.occurredAt;
              const after = row.newState.occurredAt;
              return (
                <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <ITText className="block !text-[13px] font-semibold">{row.requestedByName ?? "—"}</ITText>
                      <ITText muted className="block !text-[12px]">{row.reason}</ITText>
                      <ITText muted className="block !text-[11.5px]">
                        Checada: {when(before)}
                        {typeof after === "string" && after !== before ? ` → propone ${when(after)}` : " · sin hora propuesta"} · pedida el {when(row.createdAt)}
                      </ITText>
                      {row.decidedAt && (
                        <ITText muted className="block !text-[11.5px]">
                          {row.decidedByName ?? "—"} · {when(row.decidedAt)}
                          {row.decisionNote ? ` · ${row.decisionNote}` : ""}
                        </ITText>
                      )}
                    </div>
                    <ITBadget color={STATUS[row.status].color} size="sm">{STATUS[row.status].label}</ITBadget>
                  </div>
                  {rejecting === row.id && (
                    <ITTextarea name="decisionNote" label="Motivo del rechazo" value={note} onChange={(value) => setNote(value)} rows={2} />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {row.status === "PENDING" && rejecting !== row.id && (
                      <>
                        <ITButton variant="filled" color="primary" size="sm" disabled={busy !== null} onClick={() => void decide(row, true)}>
                          <span className="inline-flex items-center gap-1.5"><LuCheck size={13} /> Aprobar</span>
                        </ITButton>
                        <ITButton variant="outlined" color="secondary" size="sm" disabled={busy !== null} onClick={() => { setRejecting(row.id); setNote(""); }}>
                          <span className="inline-flex items-center gap-1.5"><LuX size={13} /> Rechazar</span>
                        </ITButton>
                      </>
                    )}
                    {rejecting === row.id && (
                      <>
                        <ITButton variant="filled" color="danger" size="sm" disabled={busy !== null || note.trim().length < 5} onClick={() => void decide(row, false)}>
                          Confirmar rechazo
                        </ITButton>
                        <ITButton variant="outlined" color="secondary" size="sm" onClick={() => setRejecting(null)}>Cancelar</ITButton>
                      </>
                    )}
                    <ITButton variant="text" color="secondary" size="sm" onClick={() => void openHistory(row.punchId)}>
                      <span className="inline-flex items-center gap-1.5"><LuHistory size={13} /> Ver historial</span>
                    </ITButton>
                  </div>
                </div>
              );
            })}
          </div>
        </ITCard>
      )}

      <ITDialog isOpen={history !== null} onClose={() => setHistory(null)} className="max-w-2xl">
        <DialogHeader
          icon={<LuHistory size={20} />}
          title="Historial de la checada"
          subtitle={history && history !== "loading" ? `${history.punch.name} · ${history.punch.employeeNumber || "sin número"}` : undefined}
        />
        {history === "loading" && <ContentSkeleton />}
        {history && history !== "loading" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <ITText muted className="block !text-[11px] font-semibold uppercase tracking-[0.06em]">Original (no se modifica)</ITText>
                <ITText className="block !text-[14px] font-bold">{when(history.punch.occurredAt)}</ITText>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <ITText muted className="block !text-[11px] font-semibold uppercase tracking-[0.06em]">Vigente para la jornada</ITText>
                <ITText className="block !text-[14px] font-bold">{when(history.effective.occurredAt)}</ITText>
              </div>
            </div>
            <ITText className="!text-[13px] font-semibold">Bitácora</ITText>
            {history.audit.length === 0 ? (
              <ITText muted className="!text-[12px]">Sin movimientos registrados.</ITText>
            ) : (
              <ol className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
                {history.audit.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-[12px]">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-slate-800">{AUDIT_LABEL[entry.action] ?? entry.action}</span>
                      <span className="text-slate-500"> · {entry.userName ?? "sistema"}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">{when(entry.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <ITButton variant="outlined" color="secondary" onClick={() => setHistory(null)}>Cerrar</ITButton>
        </div>
      </ITDialog>
    </>
  );
};
