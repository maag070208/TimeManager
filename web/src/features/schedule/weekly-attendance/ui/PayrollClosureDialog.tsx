import { useState } from "react";
import { ITButton, ITDialog, ITText } from "@axzydev/axzy_ui_system";
import type { TFunction } from "i18next";
import { LuCalendarCheck, LuFileSpreadsheet, LuFileText } from "react-icons/lu";
import type { PayrollClosureRow } from "@entities/schedule";
import { DialogHeader } from "@shared/ui/dialog-header";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";
import { downloadPayrollClosureCsv } from "../model/payrollClosureCsv";

/** Generador del PDF del cierre (DI: la página inyecta el de @widgets/reports). */
export type DownloadPayrollClosurePdf = (closure: PayrollClosureRow, weekLabel: string) => Promise<void>;

interface Props {
  /** Cierre abierto (null = modal cerrado). */
  closure: PayrollClosureRow | null;
  /** Etiqueta de la semana ("29 oct – 4 nov"), calculada por el padre. */
  weekLabel: string;
  t: TFunction<any>;
  /** Descarga el PDF del cierre (inyectado desde la página). */
  downloadPdf: DownloadPayrollClosurePdf;
  onClose: () => void;
}

const fmtHours = (minutes: number): string =>
  (minutes / 60).toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

/* Divs con roles ARIA (no <table>): el tema inyecta reglas globales a
   thead/tbody con !important que ensucian cualquier tabla plana. Las orillas
   van inline: las clases border-slate/border-[color:] no se generan en el CSS
   de la app y la orilla caía al currentColor (gris oscuro). */
const grid = "grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] items-center";
const th = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400";
const td = "text-[12.5px]";
const hairline = "1px solid #edf1f5";

/**
 * El detalle de un cierre del historial: el resumen por departamento tal como
 * quedó en la fotografía al cerrar la semana (aunque luego se editen checadas).
 */
export default function PayrollClosureDialog({ closure, weekLabel, t: translate, downloadPdf, onClose }: Props) {
  const t = dyn(translate);
  const departments = closure?.snapshot?.departments ?? [];
  const [exporting, setExporting] = useState(false);

  const exportPdf = () => {
    if (!closure) return;
    setExporting(true);
    void downloadPdf(closure, weekLabel).finally(() => setExporting(false));
  };

  return (
    <ITDialog isOpen={closure !== null} onClose={onClose}>
      {closure && (
        <>
          <DialogHeader
            icon={<LuCalendarCheck />}
            tone="primary"
            title={weekLabel}
            subtitle={t("history.detailSubtitle", {
              name: closure.closedBy?.name ?? "—",
              date: fmtWhen(closure.closedAt),
            })}
          />
          <div className="max-h-[55vh] overflow-y-auto">
            <div role="table" aria-label={weekLabel}>
              <div role="row" className={`${grid} px-3 py-2`} style={{ borderBottom: hairline }}>
                <span role="columnheader" className={th}>{t("deptTable.department")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("deptTable.people")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("deptTable.normalHours")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("deptTable.extraHours")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("deptTable.absences")}</span>
              </div>
              {departments.map((dept, i) => (
                <div
                  role="row"
                  key={dept.departmentId ?? "none"}
                  className={`${grid} px-3 py-2.5`}
                  style={i < departments.length - 1 ? { borderBottom: hairline } : undefined}
                >
                  <span role="cell" className={`${td} font-bold text-slate-700`}>{dept.name}</span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {dept.people}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {fmtHours(dept.normalMin)}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {fmtHours(dept.extraMin)}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {dept.absences}
                  </span>
                </div>
              ))}
              {departments.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <ITText muted className="!text-[12px]">{t("history.noSnapshot")}</ITText>
                </div>
              )}
            </div>
          </div>
          {departments.length > 0 && (
            <div className="flex items-center justify-end gap-2 px-3 py-3" style={{ borderTop: hairline }}>
              <ITButton variant="outlined" color="secondary" size="sm" onClick={exportPdf} disabled={exporting}>
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
                  <LuFileText size={13} />
                  {exporting ? t("exporting") : t("exportPdfFull")}
                </span>
              </ITButton>
              <ITButton
                variant="outlined"
                color="secondary"
                size="sm"
                onClick={() => closure && downloadPayrollClosureCsv(closure)}
              >
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
                  <LuFileSpreadsheet size={13} />
                  {t("exportExcelFull")}
                </span>
              </ITButton>
            </div>
          )}
        </>
      )}
    </ITDialog>
  );
}
