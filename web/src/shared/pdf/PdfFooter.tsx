import { Text, View } from "@react-pdf/renderer";
import { pdfTheme } from "./theme";
import { i18n } from "@shared/i18n";

interface Props {
  /**
   * Números de página cuando el documento declara las páginas manualmente.
   * Si se omiten, el pie toma los números reales de `@react-pdf/renderer`
   * (render prop) para documentos con paginación nativa.
   */
  pageIndex?: number;
  pageCount?: number;
  note?: string;
}

export default function PdfFooter({ pageIndex, pageCount, note }: Props) {
  const manual =
    pageIndex !== undefined && pageCount !== undefined ? { pageIndex, pageCount } : null;
  return (
    <View style={pdfTheme.footer} fixed>
      <Text style={pdfTheme.footerText}>
        {note ?? i18n.t("common:pdf.footer")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {manual ? (
          <Text style={pdfTheme.footerPage}>
            {i18n.t("common:pdf.pageOf", { current: manual.pageIndex + 1, total: manual.pageCount })}
          </Text>
        ) : (
          <Text
            style={pdfTheme.footerPage}
            render={({ pageNumber, totalPages }) => i18n.t("common:pdf.pageOf", { current: pageNumber, total: totalPages })}
          />
        )}
        <Text style={pdfTheme.footerPowered}>powered by axzy.dev</Text>
      </View>
    </View>
  );
}
