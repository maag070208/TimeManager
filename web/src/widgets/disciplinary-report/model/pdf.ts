import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { DisciplinaryReport } from "@entities/hr";
import DisciplinaryReportPdf from "../ui/DisciplinaryReportPdf";
import { fileName } from "@shared/i18n";

export const downloadDisciplinaryReportPdf = async (disciplinaryReport: DisciplinaryReport): Promise<void> => {
  const blob = await pdf(
    createElement(DisciplinaryReportPdf, { disciplinaryReport }) as any
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName("disciplinaryReport")}-${disciplinaryReport.user.employeeNumber ?? disciplinaryReport.user.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};