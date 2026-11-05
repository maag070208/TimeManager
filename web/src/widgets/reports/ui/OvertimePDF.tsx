import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { useTranslation } from "react-i18next";
import type { OvertimeDayStatus, OvertimePdfPayload } from "@entities/overtime";
import { PDF_COLORS, pdfTheme } from "@shared/pdf/theme";
import { formatDateTime, formatMinutesAsHhMm } from "@shared/utils/dates";
import { dyn } from "@shared/i18n/dyn";
import PdfLetterhead from "@shared/pdf/PdfLetterhead";
import PdfFooter from "@shared/pdf/PdfFooter";

const styles = StyleSheet.create({
  rangeBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PDF_COLORS.band,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  rangeBandLabel: {
    fontSize: 6.3,
    color: "#bfe0f0",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rangeBandValue: { fontSize: 11, color: PDF_COLORS.white, fontFamily: "Helvetica-Bold" },
  rangeBandTz: { fontSize: 7.5, color: PDF_COLORS.white, fontFamily: "Helvetica-Bold" },
});

// Anchos en puntos (LETTER apaisado ≈ 720 útiles). Deben sumar ≈ 720.
const COL = {
  employee: 118,
  department: 86,
  day: 52,
  schedule: 92,
  extra: 50,
  status: 64,
  decidedBy: 88,
  decidedAt: 88,
  note: 82,
};

const STATUS_LABEL: Record<OvertimeDayStatus, string> = {
  PENDING: "statusPending",
  APPROVED: "statusApproved",
  REJECTED: "statusRejected",
};

/** Color del texto del estatus (como los badges de la tabla). */
const STATUS_COLOR: Record<OvertimeDayStatus, string> = {
  PENDING: "#b45309", // warning / ámbar
  APPROVED: "#15803d", // success / verde
  REJECTED: "#dc2626", // danger / rojo
};

/** Día local `YYYY-MM-DD` a `DD/MM/YYYY` sin conversión de zona (es una clave). */
const fmtDayKey = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-");
  return d && m && y ? `${d}/${m}/${y}` : dayKey;
};

/** Fecha civil `DD/MM/YYYY` de un instante en la zona horaria efectiva. */
const fmtDateInTZ = (iso: string, tz?: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));

/** Día calendario anterior a un instante (el fin de rango del reporte es exclusivo). */
const prevCivilDay = (iso: string, tz?: string): string => {
  const [dd, mm, yyyy] = fmtDateInTZ(iso, tz).split("/").map(Number);
  const prev = new Date(Date.UTC(yyyy, mm - 1, dd - 1));
  return `${String(prev.getUTCDate()).padStart(2, "0")}/${String(prev.getUTCMonth() + 1).padStart(2, "0")}/${prev.getUTCFullYear()}`;
};

/**
 * Tiempo extra: réplica de la tabla de la pantalla (una fila por persona y día)
 * con el estado de aprobación, quién decidió y la nota, en estilo de reporte
 * formal (banda institucional, tarjetas grises y texto oscuro, sin chips).
 * ADMIN/GERENTE ven los minutos calculados; RH solo los aprobados.
 */
export default function OvertimePDF({ rows, summary, meta, canApprove }: OvertimePdfPayload) {
  const { t } = useTranslation("overtime");
  const tt = dyn(t);
  const tz = summary.range.timezone || meta.timezone;
  const today = formatDateTime(new Date().toISOString());

  const period = summary.range.period || meta.period;
  const rangeLabel =
    period === "DAY"
      ? fmtDateInTZ(summary.range.start, tz)
      : `${fmtDateInTZ(summary.range.start, tz)} — ${prevCivilDay(summary.range.end, tz)}`;

  const cards: Array<{ label: string; value: string | number }> = canApprove
    ? [
        { label: t("kpis.pending"), value: formatMinutesAsHhMm(summary.pendingMinutes) },
        { label: t("kpis.approved"), value: formatMinutesAsHhMm(summary.approvedMinutes) },
        { label: t("kpis.rejected"), value: formatMinutesAsHhMm(summary.rejectedMinutes) },
        { label: t("kpis.people"), value: summary.peopleWithPending },
      ]
    : [
        { label: t("kpis.approved"), value: formatMinutesAsHhMm(summary.approvedMinutes) },
        { label: t("kpis.approvedDays"), value: summary.approvedDays },
      ];

  return (
    <Document title={t("pdf.title")} author="TimeManager">
      <Page size="LETTER" orientation="landscape" style={pdfTheme.page}>
        <View fixed>
          <PdfLetterhead title={t("pdf.title")} generatedAt={today} />
        </View>

        <View style={pdfTheme.content}>
          <View style={pdfTheme.summaryRow}>
            {cards.map((c) => (
              <View key={c.label} style={pdfTheme.summaryCard}>
                <Text style={pdfTheme.summaryValue}>{c.value}</Text>
                <Text style={pdfTheme.summaryLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.rangeBand}>
            <View>
              <Text style={styles.rangeBandLabel}>{tt(`periods.${period}`)}</Text>
              <Text style={styles.rangeBandValue}>{rangeLabel}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.rangeBandLabel}>{t("pdf.timezone")}</Text>
              <Text style={styles.rangeBandTz}>{summary.range.timezone}</Text>
            </View>
          </View>

          <View style={pdfTheme.tableHeader} fixed>
            <View style={{ width: COL.employee }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.employee")}</Text>
            </View>
            <View style={{ width: COL.department }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.department")}</Text>
            </View>
            <View style={{ width: COL.day }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.date")}</Text>
            </View>
            <View style={{ width: COL.schedule }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.schedule")}</Text>
            </View>
            <View style={{ width: COL.extra }}>
              <Text style={[pdfTheme.tableHeaderText, { textAlign: "right" }]}>
                {canApprove ? t("columns.extra") : t("statusApproved")}
              </Text>
            </View>
            <View style={{ width: COL.status }}>
              <Text style={[pdfTheme.tableHeaderText, { textAlign: "center" }]}>{t("status")}</Text>
            </View>
            <View style={{ width: COL.decidedBy }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.decidedBy")}</Text>
            </View>
            <View style={{ width: COL.decidedAt }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.decidedAt")}</Text>
            </View>
            <View style={{ width: COL.note }}>
              <Text style={pdfTheme.tableHeaderText}>{t("columns.note")}</Text>
            </View>
          </View>

          {rows.map((r, i) => (
            <View
              key={`${r.userId}-${r.date}-${i}`}
              wrap={false}
              style={i % 2 === 0 ? pdfTheme.tableRow : pdfTheme.tableRowAlt}
            >
              <View style={{ width: COL.employee }}>
                <Text style={pdfTheme.cellDescTitle}>{r.employeeName}</Text>
                <Text style={pdfTheme.cellDescSub}>{r.employeeNumber ? `#${r.employeeNumber}` : "—"}</Text>
              </View>
              <View style={{ width: COL.department }}>
                <Text style={pdfTheme.cellMuted}>{r.departmentName ?? "—"}</Text>
              </View>
              <View style={{ width: COL.day }}>
                <Text style={pdfTheme.cell}>{fmtDayKey(r.date)}</Text>
              </View>
              <View style={{ width: COL.schedule }}>
                <Text style={r.scheduleName ? pdfTheme.cell : pdfTheme.cellMuted}>
                  {r.scheduleName ?? t("columns.noSchedule")}
                </Text>
              </View>
              <View style={{ width: COL.extra }}>
                <Text
                  style={[
                    pdfTheme.cellBold,
                    { textAlign: "right", color: canApprove ? "#e11d48" : "#047857" },
                  ]}
                >
                  {formatMinutesAsHhMm(canApprove ? r.extraMin : r.approvedExtraMin)}
                </Text>
              </View>
              <View style={{ width: COL.status, alignItems: "center" }}>
                <Text style={[pdfTheme.cell, { color: STATUS_COLOR[r.status] }]}>{tt(STATUS_LABEL[r.status])}</Text>
              </View>
              <View style={{ width: COL.decidedBy }}>
                <Text style={pdfTheme.cell}>{r.decidedByName ?? "—"}</Text>
              </View>
              <View style={{ width: COL.decidedAt }}>
                <Text style={pdfTheme.cellMuted}>{r.decidedAt ? formatDateTime(r.decidedAt) : "—"}</Text>
              </View>
              <View style={{ width: COL.note }}>
                <Text style={pdfTheme.cellMuted}>{r.note ?? "—"}</Text>
              </View>
            </View>
          ))}
        </View>

        <PdfFooter />
      </Page>
    </Document>
  );
}
