import { fileName, i18n } from "@shared/i18n";
import type { TFunction } from "i18next";
import type { PayrollClosureRow } from "@entities/schedule";
import { buildPayrollClosureCsv } from "./payrollClosureCsv.core";

const download = (csv: string, weekStart: string): void => {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName("payroll")}_cierre_${weekStart}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * El "Excel" de un cierre del historial: un CSV (lo abre Excel directo) con el
 * detalle por persona agrupado por departamento (si la fotografía lo guardó;
 * si no, solo el resumen por departamento) y los totales de la semana.
 *
 * El armado del CSV vive en `payrollClosureCsv.core.ts` (puro y testeable).
 */
export const downloadPayrollClosureCsv = (closure: PayrollClosureRow): void => {
  if ((closure.snapshot?.departments ?? []).length === 0) return;
  // El catálogo de llaves está tipado por namespace; aquí se compone la llave
  // dinámicamente, así que se usa el TFunction sin tipar (como `dyn`).
  const t = i18n.getFixedT(null, "weekly-attendance") as TFunction<any>;
  download(buildPayrollClosureCsv(closure, t), closure.weekStart);
};
