import { ITButton, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaFileCsv, FaFilePdf } from "react-icons/fa";
import type { UseAccessReport } from "../model/useAccessReport";

/** Botones de exportación del reporte (PDF y CSV), para el `actions` del `ITPage`. */
export default function AccessReportExportActions({ fx }: { fx: UseAccessReport }) {
  const { t, exporting, handleDownloadPdf, handleDownloadCsv } = fx;
  return (
    <ITFlex gap={2} wrap="wrap">
      <ITButton variant="outlined" color="gray" onClick={handleDownloadPdf} disabled={exporting}>
        <ITFlex align="center" gap={1}>
          <FaFilePdf className="text-red-600" size={13} />
          <ITText className="font-bold text-[11px]">{t("actions.exportPdf")}</ITText>
        </ITFlex>
      </ITButton>
      <ITButton variant="filled" color="primary" onClick={handleDownloadCsv} disabled={exporting}>
        <ITFlex align="center" gap={1}>
          <FaFileCsv size={13} />
          <ITText className="font-bold text-[11px]">{t("actions.exportCsv")}</ITText>
        </ITFlex>
      </ITButton>
    </ITFlex>
  );
}
