import { PDFViewer } from "@react-pdf/renderer";
import type { DisciplinaryReport } from "@entities/hr";
import DisciplinaryReportPdf from "./DisciplinaryReportPdf";

export default function DisciplinaryReportPreview({ disciplinaryReport }: { disciplinaryReport: DisciplinaryReport }) {
  return (
    <PDFViewer
      style={{ width: "100%", height: 720, border: "none", borderRadius: 16 }}
      showToolbar
    >
      <DisciplinaryReportPdf disciplinaryReport={disciplinaryReport} />
    </PDFViewer>
  );
}