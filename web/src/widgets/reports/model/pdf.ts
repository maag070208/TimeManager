import { saveAs } from "file-saver";
import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { fileName, i18n } from "@shared/i18n";
import type {
  AccessReportPdfMeta,
  AccessReportSessionRow,
  AccessReportSummary,
} from "@entities/access";
import type { OvertimePdfPayload } from "@entities/overtime";
import type { PayrollClosureRow, WeeklyAttendancePdfPayload } from "@entities/schedule";
import AccessReportPDF from "../ui/AccessReportPDF";
import OvertimePDF from "../ui/OvertimePDF";
import WeeklyAttendancePdf from "../ui/WeeklyAttendancePdf";
import PayrollClosurePdf from "../ui/PayrollClosurePdf";

export const downloadAccessReportPDF = async (
  rows: AccessReportSessionRow[],
  summary: AccessReportSummary,
  meta: AccessReportPdfMeta
): Promise<void> => {
  const blob = await pdf(
    createElement(AccessReportPDF, { rows, summary, meta }) as any
  ).toBlob();
  const stamp = meta.date;
  saveAs(blob, `${fileName("accessReport")}_${meta.period}_${stamp}.pdf`);
};

/** Entradas/salidas del reloj checador: mismo PDF que el de accesos, con su título. */
export const downloadTimeClockReportPdf = async (
  rows: AccessReportSessionRow[],
  summary: AccessReportSummary,
  meta: AccessReportPdfMeta
): Promise<void> => {
  const title = i18n.t("time-clock:report.pdfTitle");
  const blob = await pdf(
    createElement(AccessReportPDF, { rows, summary, meta, title }) as any
  ).toBlob();
  saveAs(blob, `${fileName("timeClockReport")}_${meta.period}_${meta.date}.pdf`);
};

export const downloadOvertimePDF = async (payload: OvertimePdfPayload): Promise<void> => {
  const { rows, summary, meta, canApprove } = payload;
  const blob = await pdf(
    createElement(OvertimePDF, { rows, summary, meta, canApprove }) as any
  ).toBlob();
  const stamp = meta.date.replace(/-/g, "");
  saveAs(blob, `${fileName("overtimeReport")}_${meta.period.toLowerCase()}_${stamp}.pdf`);
};

/** Nómina semanal: réplica de la tabla (vista Resumida o Detallada). */
export const downloadWeeklyAttendancePdf = async (
  payload: WeeklyAttendancePdfPayload
): Promise<void> => {
  const { report, mode, rows, meta } = payload;
  const blob = await pdf(
    createElement(WeeklyAttendancePdf, { report, mode, rows, meta }) as any
  ).toBlob();
  saveAs(blob, `${fileName("payroll")}_${report.range.days[0]}.pdf`);
};

/** Cierre de pre-nómina desde la fotografía guardada (historial de cierres). */
export const downloadPayrollClosurePdf = async (
  closure: PayrollClosureRow,
  weekLabel: string
): Promise<void> => {
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const blob = await pdf(
    createElement(PayrollClosurePdf, { closure, weekLabel, generatedAt }) as any
  ).toBlob();
  saveAs(blob, `${fileName("payroll")}_cierre_${closure.weekStart}.pdf`);
};
