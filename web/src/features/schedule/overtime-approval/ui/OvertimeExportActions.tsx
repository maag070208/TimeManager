import { ITButton, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaFileCsv, FaFilePdf } from "react-icons/fa";
import type { UseOvertimeApproval } from "../model/useOvertimeApproval";

/** Botones de exportación (PDF y CSV) para el `actions` del `ITPage`. Sin filas quedan deshabilitados. */
export default function OvertimeExportActions({ fx }: { fx: UseOvertimeApproval }) {
  const { t, total, exportingPdf, exportingCsv, exportPdf, exportCsv } = fx;
  const busy = exportingPdf || exportingCsv;
  return (
    <ITFlex gap={2} wrap="wrap">
      <ITButton variant="outlined" color="gray" onClick={() => void exportPdf()} disabled={total === 0 || busy}>
        <ITFlex align="center" gap={1}>
          <FaFilePdf className="text-red-600" size={13} />
          <ITText className="font-bold text-[11px]">{t("exportPdf")}</ITText>
        </ITFlex>
      </ITButton>
      <ITButton variant="filled" color="primary" onClick={() => void exportCsv()} disabled={total === 0 || busy}>
        <ITFlex align="center" gap={1}>
          <FaFileCsv size={13} />
          <ITText className="font-bold text-[11px]">{t("exportCsv")}</ITText>
        </ITFlex>
      </ITButton>
    </ITFlex>
  );
}
