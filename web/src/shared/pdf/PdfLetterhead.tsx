import { Image, Text, View } from "@react-pdf/renderer";
import { LOGO_PUERTO_NUEVO_BASE64 } from "@shared/assets/logoPuertoNuevo";
import { pdfTheme } from "./theme";
import { i18n } from "@shared/i18n";

interface Props {
  title: string;
  generatedAt: string;
  /**
   * Números de página cuando el documento declara las páginas manualmente
   * (varios `<Page>` con slices). Si se omiten, el membrete toma los números
   * reales de `@react-pdf/renderer` (render prop), para documentos que usan su
   * paginación nativa: así el rótulo siempre coincide con la página física.
   */
  pageIndex?: number;
  pageCount?: number;
}

// Membrete institucional compartido por los reportes del sistema (Entregas,
// Asignados, Dispositivos). Se renderiza igual en cada página para que el
// documento se lea como una sola pieza profesional, no como una tabla suelta.
export default function PdfLetterhead({ title, pageIndex, pageCount, generatedAt }: Props) {
  const manual =
    pageIndex !== undefined && pageCount !== undefined ? { pageIndex, pageCount } : null;
  return (
    <View>
      <View style={pdfTheme.band}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={pdfTheme.logoBadge}>
            <Image src={LOGO_PUERTO_NUEVO_BASE64} style={pdfTheme.logoImg} />
          </View>
          <View style={pdfTheme.bandTextWrap}>
            <Text style={pdfTheme.bandHotel}>TimeManager</Text>
            <Text style={pdfTheme.bandDoc}>{title}</Text>
          </View>
        </View>
        <View style={pdfTheme.bandMetaWrap}>
          <Text style={pdfTheme.bandMeta}>
            {i18n.t("common:pdf.generated")} <Text style={pdfTheme.bandMetaStrong}>{generatedAt}</Text>
          </Text>
          {manual ? (
            <Text style={pdfTheme.bandMeta}>
              {i18n.t("common:pdf.page")} <Text style={pdfTheme.bandMetaStrong}>{manual.pageIndex + 1}</Text> {i18n.t("common:pdf.of")}{" "}
              {manual.pageCount}
            </Text>
          ) : (
            <Text
              style={pdfTheme.bandMeta}
              render={({ pageNumber, totalPages }) => (
                <>
                  {i18n.t("common:pdf.page")}{" "}
                  <Text style={pdfTheme.bandMetaStrong}>{pageNumber}</Text> {i18n.t("common:pdf.of")} {totalPages}
                </>
              )}
            />
          )}
        </View>
      </View>
      <View style={pdfTheme.bandAccentLine} />
    </View>
  );
}
