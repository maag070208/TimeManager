import { useEffect, useState } from "react";
import { ITBadget, ITCard, ITText } from "@axzydev/axzy_ui_system";
import type { TFunction } from "i18next";
import { LuFileSpreadsheet, LuFileText } from "react-icons/lu";
import { scheduleApi, type PayrollClosureRow } from "@entities/schedule";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";
import { downloadPayrollClosureCsv } from "../model/payrollClosureCsv";
import PayrollClosureDialog, { type DownloadPayrollClosurePdf } from "./PayrollClosureDialog";

/** Mes corto sin el punto que agrega el locale ("nov." → "nov"). */
const shortMonth = (d: Date) => d.toLocaleDateString(dateLocale(), { month: "short" }).replace(/\./g, "");

/** "29 oct – 4 nov" a partir del primer día de la semana. */
const weekLabel = (weekStart: string): string => {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${start.getDate()} – ${end.getDate()} ${shortMonth(end)}`
    : `${start.getDate()} ${shortMonth(start)} – ${end.getDate()} ${shortMonth(end)}`;
};

const fmtHours = (minutes: number): string =>
  (minutes / 60).toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

/* Divs con roles ARIA (no <table>): el tema inyecta reglas globales a
   thead/tbody con !important que ensucian cualquier tabla plana. Las orillas
   van inline: las clases border-slate/border-[color:] no se generan en el CSS
   de la app y la orilla caía al currentColor (gris oscuro). */
const grid =
  "grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,0.8fr))_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] items-center";
const th = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400";
const td = "text-[12.5px]";
const hairline = "1px solid #edf1f5";

/**
 * Historial de cierres de la pre-nómina: cada semana cerrada con la
 * fotografía de sus cifras, quién la cerró y si sigue cerrada o se reabrió.
 */
export default function PayrollHistoryPanel({
  t: translate,
  downloadPdf,
}: {
  t: TFunction<any>;
  /** Descarga el PDF del cierre (inyectado desde la página). */
  downloadPdf: DownloadPayrollClosurePdf;
}) {
  const t = dyn(translate);
  const [rows, setRows] = useState<PayrollClosureRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Cierre abierto en el modal de detalle (null = cerrado). */
  const [openClosure, setOpenClosure] = useState<PayrollClosureRow | null>(null);
  /** Semana cuyo PDF de renglón se está generando (deshabilita su botón). */
  const [exportingWeek, setExportingWeek] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    scheduleApi
      .payrollClosures()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
    <ITCard className="!border-0" contentClassName="!p-0">
      <div className="overflow-x-auto">
        <div role="table" aria-label={t("history.title")} className="min-w-[860px]">
          <div role="row" className={`${grid} px-4 py-2.5`} style={{ borderBottom: hairline }}>
            <span role="columnheader" className={th}>{t("history.week")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("history.people")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("history.worked")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("history.approved")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("history.absences")}</span>
            <span role="columnheader" className={th}>{t("history.closedBy")}</span>
            <span role="columnheader" className={th}>{t("history.closedAt")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("history.status")}</span>
            <span role="columnheader" className={`${th} text-right`} />
          </div>
          {rows?.map((row, i) => {
            const s = row.snapshot?.summary;
            return (
              <div
                role="row"
                key={row.weekStart}
                onClick={() => setOpenClosure(row)}
                className={`${grid} cursor-pointer px-4 py-3 transition hover:bg-slate-50`}
                style={i < rows.length - 1 ? { borderBottom: hairline } : undefined}
              >
                <span role="cell" className={`${td} font-black text-slate-800`}>{weekLabel(row.weekStart)}</span>
                <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                  {s?.people ?? "—"}
                </span>
                <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                  {s?.workedMin !== undefined ? fmtHours(s.workedMin) : "—"}
                </span>
                <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                  {s?.approvedExtraMin !== undefined ? fmtHours(s.approvedExtraMin) : "—"}
                </span>
                <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                  {s?.absences ?? "—"}
                </span>
                <span role="cell" className={`${td} font-semibold text-slate-700`}>{row.closedBy?.name ?? "—"}</span>
                <span role="cell" className={`${td} tabular-nums text-slate-500`}>{fmtWhen(row.closedAt)}</span>
                <span role="cell" className={`${td} flex justify-center`}>
                  {row.closed ? (
                    <ITBadget color="success" size="sm">{t("history.closed")}</ITBadget>
                  ) : (
                    <span
                      title={t("history.reopenedTooltip", {
                        name: row.reopenedBy?.name ?? "—",
                        date: row.reopenedAt ? fmtWhen(row.reopenedAt) : "",
                      })}
                    >
                      <ITBadget color="warning" size="sm">{t("history.reopened")}</ITBadget>
                    </span>
                  )}
                </span>
                <span role="cell" className={`${td} flex justify-end gap-1.5`}>
                  {/* Descargar desde la tabla, sin abrir el modal (por eso stopPropagation). */}
                  <button
                    type="button"
                    title={t("exportPdfFull")}
                    aria-label={t("exportPdfFull")}
                    disabled={exportingWeek === row.weekStart}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportingWeek(row.weekStart);
                      void downloadPdf(row, weekLabel(row.weekStart)).finally(() => setExportingWeek(null));
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-full !bg-transparent px-2.5 py-1 !text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <LuFileText size={12} />
                    PDF
                  </button>
                  <button
                    type="button"
                    title={t("exportExcelFull")}
                    aria-label={t("exportExcelFull")}
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPayrollClosureCsv(row);
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-full !bg-transparent px-2.5 py-1 !text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <LuFileSpreadsheet size={12} />
                    Excel
                  </button>
                </span>
              </div>
            );
          })}
          {rows !== null && rows.length === 0 && (
            <div className="px-4 py-8 text-center">
              <ITText muted className="!text-[12px]">{t("history.empty")}</ITText>
            </div>
          )}
          {error && (
            <div className="px-4 py-8 text-center">
              <ITText className="!text-[12px] !text-red-500">{error}</ITText>
            </div>
          )}
        </div>
      </div>
    </ITCard>

    <PayrollClosureDialog
      closure={openClosure}
      weekLabel={openClosure ? weekLabel(openClosure.weekStart) : ""}
      t={translate}
      downloadPdf={downloadPdf}
      onClose={() => setOpenClosure(null)}
    />
    </>
  );
}
