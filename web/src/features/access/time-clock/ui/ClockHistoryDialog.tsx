import { ITBadget, ITButton, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleCheck, LuCircleX, LuHistory, LuRefreshCw } from "react-icons/lu";
import {
  timeClockApi,
  type TimeClockDevice,
  type TimeClockSyncEvent,
  type TimeClockSyncHistory,
  type TimeClockSyncTrigger,
} from "@entities/time-clock";
import { formatDateTime } from "@shared/utils/dates";
import { DialogHeader } from "@shared/ui/dialog-header";
import { LangostinState } from "@shared/ui/langostin";

/**
 * Timeline de sincronización de un reloj: cada intento con su hora, si conectó,
 * cuántas checadas trajo y, cuando falla, el motivo tal cual lo reportó el
 * equipo. Es la pantalla de soporte: "falló → reintentó → conectó → falló".
 */
export default function ClockHistoryDialog({
  device,
  onClose,
}: {
  /** El reloj a mostrar; `null` cierra el diálogo. */
  device: TimeClockDevice | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(["time-clock", "common"]);
  const [historial, setHistorial] = useState<TimeClockSyncHistory | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const serial = device?.clockSerial ?? null;

  const cargar = useCallback(async () => {
    if (!serial) return;
    setCargando(true);
    setError(false);
    try {
      setHistorial(await timeClockApi.clockEvents(serial));
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [serial]);

  useEffect(() => {
    if (!serial) {
      setHistorial(null);
      return;
    }
    void cargar();
  }, [serial, cargar]);

  const segundos = (evento: TimeClockSyncEvent): number =>
    Math.max(0, Math.round((new Date(evento.finishedAt).getTime() - new Date(evento.startedAt).getTime()) / 1000));

  const disparador = (trigger: TimeClockSyncTrigger): string => t(`history.triggers.${trigger}`);

  const resumen = historial?.summary;

  return (
    <ITDialog
      isOpen={device !== null}
      onClose={onClose}
      className="max-w-2xl"
    >
      <DialogHeader
        icon={<LuHistory />}
        title={device ? t("history.title", { name: device.name }) : ""}
        subtitle={device?.url}
      />
      <ITFlex direction="column" gap={3}>
        <ITFlex align="center" wrap="wrap" gap={2}>
          <ITButton variant="text" size="sm" className="ml-auto" disabled={cargando} onClick={() => void cargar()}>
            <ITFlex align="center" gap={1}>
              <LuRefreshCw size={12} className={cargando ? "animate-spin" : undefined} />
              <ITText className="text-[11px] font-bold">{t("history.refresh")}</ITText>
            </ITFlex>
          </ITButton>
        </ITFlex>

        {resumen && (
          <div className="grid grid-cols-1 gap-2 sm:!grid-cols-3">
            <Indicador
              titulo={t("history.attempts")}
              valor={`${resumen.okCount} / ${resumen.attempts}`}
              detalle={t("history.failedCount", { count: resumen.failCount })}
            />
            <Indicador
              titulo={t("history.failuresInARow")}
              valor={String(resumen.failuresInARow)}
              detalle={resumen.failuresInARow === 0 ? t("history.healthy") : t("history.checking")}
              alerta={resumen.failuresInARow > 0}
            />
            <Indicador
              titulo={t("history.lastOk")}
              valor={resumen.lastOkAt ? formatDateTime(resumen.lastOkAt) : t("history.never")}
              detalle={resumen.lastFailAt ? t("history.lastFail", { at: formatDateTime(resumen.lastFailAt) }) : ""}
            />
          </div>
        )}

        {resumen?.lastError && (
          <div className="rounded-2xl px-3.5 py-2.5" style={{ background: "var(--color-danger-soft)" }}>
            <ITText className="text-[12px] font-semibold text-[color:var(--color-danger)]">
              {t("history.lastError")}
            </ITText>
            <ITText className="text-[11px] text-slate-700 break-words">{resumen.lastError}</ITText>
          </div>
        )}

        {cargando && !historial ? (
          <LangostinState kind="loading" size="sm" />
        ) : error ? (
          <LangostinState kind="error" size="sm" description={t("history.loadError")} />
        ) : historial && historial.events.length === 0 ? (
          <LangostinState kind="empty" size="sm" description={t("history.empty")} />
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-2xl bg-[color-mix(in_srgb,currentColor_5%,transparent)]">
            {historial?.events.map((evento, indice) => (
              <ITFlex
                key={evento.id}
                align="start"
                gap={2}
                className={`px-3.5 py-2.5 ${indice > 0 ? " " : ""}`}
              >
                {evento.ok ? (
                  <LuCircleCheck size={14} className="mt-0.5 shrink-0 text-[color:var(--color-success)]" />
                ) : (
                  <LuCircleX size={14} className="mt-0.5 shrink-0 text-[color:var(--color-danger)]" />
                )}
                <ITFlex direction="column" gap={0.5} className="min-w-0 flex-1">
                  <ITFlex align="center" wrap="wrap" gap={1}>
                    <ITText className="text-[12px] font-bold text-slate-800">
                      {formatDateTime(evento.finishedAt)}
                    </ITText>
                    <ITBadget color={evento.ok ? "success" : "danger"} size="sm">
                      {evento.ok ? t("history.ok") : t("history.failed")}
                    </ITBadget>
                    <ITText className="text-[10px] font-bold text-slate-400">{disparador(evento.trigger)}</ITText>
                    <ITText className="text-[10px] text-slate-400">
                      {t("history.duration", { seconds: segundos(evento) })}
                    </ITText>
                  </ITFlex>
                  {evento.ok ? (
                    <ITText className="text-[11px] text-slate-600">
                      {t("history.read", { read: evento.readCount, new: evento.newCount })}
                    </ITText>
                  ) : (
                    <ITText className="text-[11px] text-[color:var(--color-danger)] break-words">{evento.error}</ITText>
                  )}
                </ITFlex>
              </ITFlex>
            ))}
          </div>
        )}

        <ITText className="text-[10px] text-slate-400">{t("history.hint")}</ITText>
      </ITFlex>
    </ITDialog>
  );
}

/** Un dato del resumen; en rojo cuando pide atención. */
function Indicador({
  titulo,
  valor,
  detalle,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3.5 py-2.5 ${alerta ? "" : "bg-[color-mix(in_srgb,currentColor_5%,transparent)]"}`}
      style={alerta ? { background: "var(--color-danger-soft)" } : undefined}
    >
      <ITText className="text-[12px] font-semibold text-slate-400">{titulo}</ITText>
      <ITText className={`text-[13px] font-black ${alerta ? "text-[color:var(--color-danger)]" : "text-slate-800"}`}>{valor}</ITText>
      {detalle && <ITText className="text-[10px] text-slate-500">{detalle}</ITText>}
    </div>
  );
}
