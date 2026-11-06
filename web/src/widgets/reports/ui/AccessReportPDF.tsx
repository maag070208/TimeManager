import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { useTranslation } from "react-i18next";
import type {
  AccessIncidentCode,
  AccessReportPdfMeta,
  AccessReportSessionRow,
  AccessReportSummary,
} from "@entities/access";
import { PDF_COLORS, pdfTheme, badgeStyleFor } from "@shared/pdf/theme";
import { formatMinutesAsHhMm, formatTimeInTZ } from "@shared/utils/dates";
import PdfLetterhead from "@shared/pdf/PdfLetterhead";
import PdfFooter from "@shared/pdf/PdfFooter";

interface Props {
  rows: AccessReportSessionRow[];
  summary: AccessReportSummary;
  meta: AccessReportPdfMeta;
  title?: string;
}

type BadgeKind = "success" | "warning" | "danger" | "gray" | "info";

const INCIDENT_COLOR: Record<AccessIncidentCode, BadgeKind> = {
  OPEN_ENTRY: "info",
  ENTRY_WITHOUT_EXIT: "warning",
  EXIT_WITHOUT_ENTRY: "danger",
  REMOTE_CONFLICT: "info",
};

const styles = StyleSheet.create({
  badgeRow: { flexDirection: "row", flexWrap: "wrap" },
  badgeGap: { marginRight: 2, marginBottom: 2 },

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

  kpiCard: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: PDF_COLORS.border,
  },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  kpiLabel: {
    fontSize: 6.3,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  totalsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: PDF_COLORS.band,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  totalsItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  totalsLabel: {
    fontSize: 6.8,
    color: "#bfe0f0",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  totalsValue: { fontSize: 10.5, color: PDF_COLORS.white, fontFamily: "Helvetica-Bold" },
});

// Anchos en puntos; suman ~526 (folio LETTER − padding horizontal de 36×2).
const COL = {
  employee: 132,
  department: 92,
  date: 52,
  entry: 62,
  exit: 62,
  hours: 44,
  incident: 82,
};

const fmtMinutes = formatMinutesAsHhMm;

/** Fecha civil `DD/MM/YYYY` desde una clave `YYYY-MM-DD` (sin conversión de zona). */
const fmtDayKey = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-");
  return d && m && y ? `${d}/${m}/${y}` : dayKey;
};

const fmtStamp = (iso: string | null, period: string, tz?: string): string => {
  if (!iso) return "—";
  const time = formatTimeInTZ(iso, tz);
  if (period === "DAY") return time;
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} ${time}`;
};

const fmtDateTime = (iso: string, tz?: string): string => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy} ${formatTimeInTZ(iso, tz)}`;
};

/** Fecha civil `DD/MM/YYYY` de un instante en la zona horaria efectiva. */
const fmtDateInTZ = (iso: string, tz?: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Día calendario anterior al instante dado, en la zona horaria efectiva.
 * `summary.range.end` es EXCLUSIVO (medianoche del día siguiente): para que el
 * rango se lea como `[start, end)` se resta un día civil al límite.
 */
const prevCivilDay = (iso: string, tz?: string): string => {
  const [dd, mm, yyyy] = fmtDateInTZ(iso, tz).split("/").map(Number);
  const prev = new Date(Date.UTC(yyyy, mm - 1, dd - 1));
  const pdd = String(prev.getUTCDate()).padStart(2, "0");
  const pmm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  return `${pdd}/${pmm}/${prev.getUTCFullYear()}`;
};

export default function AccessReportPDF({ rows, summary, meta, title }: Props) {
  const { t: tt } = useTranslation(["access-report"]);
  const reportTitle = title ?? tt("pdf.title");
  const tz = summary.range.timezone || meta.timezone;
  const today = fmtDateTime(new Date().toISOString(), tz);

  const rangePeriod = summary.range.period || meta.period;
  const rangeLabel =
    rangePeriod === "DAY"
      ? fmtDateInTZ(summary.range.start, tz)
      : `${fmtDateInTZ(summary.range.start, tz)} — ${prevCivilDay(summary.range.end, tz)}`;

  const cards: Array<{ label: string; value: string | number; color: string; bg: string }> = [
    { label: tt("kpis.withRecords"), value: summary.peopleWithRecords, color: PDF_COLORS.success, bg: PDF_COLORS.successBg },
    { label: tt("kpis.withoutRecords"), value: summary.peopleWithoutRecords, color: PDF_COLORS.gray, bg: PDF_COLORS.grayBg },
    { label: tt("kpis.inside"), value: summary.peopleInside, color: PDF_COLORS.band, bg: "#dbeafe" },
    { label: tt("kpis.workedHours"), value: fmtMinutes(summary.totalWorkedMinutes), color: PDF_COLORS.band, bg: PDF_COLORS.light },
    { label: tt("kpis.incidents"), value: summary.totalIncidents, color: PDF_COLORS.warning, bg: PDF_COLORS.warningBg },
  ];

  const ROWS_PER_PAGE = 22;
  const pages: AccessReportSessionRow[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const renderIncident = (incident: AccessIncidentCode | null) =>
    incident ? (
      <Text style={[badgeStyleFor(INCIDENT_COLOR[incident]), styles.badgeGap]}>
        {tt(`incidents.${incident}`)}
      </Text>
    ) : (
      <Text style={pdfTheme.cellMuted}>—</Text>
    );

  return (
    <Document title={reportTitle} author="CheckLab">
      {pages.map((pageRows, pageIdx) => (
        <Page key={pageIdx} size="LETTER" style={pdfTheme.page}>
          <PdfLetterhead
            title={reportTitle}
            pageIndex={pageIdx}
            pageCount={pages.length}
            generatedAt={today}
          />

          <View style={pdfTheme.content}>
            {pageIdx === 0 && (
              <>
                <View style={pdfTheme.summaryRow}>
                  {cards.map((c) => (
                    <View key={c.label} style={[styles.kpiCard, { backgroundColor: c.bg }]}>
                      <Text style={[styles.kpiValue, { color: c.color }]}>{c.value}</Text>
                      <Text style={styles.kpiLabel}>{c.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.rangeBand}>
                  <View>
                    <Text style={styles.rangeBandLabel}>{tt(`periods.${meta.period}`)}</Text>
                    <Text style={styles.rangeBandValue}>{rangeLabel}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.rangeBandLabel}>{tt("pdf.timezone")}</Text>
                    <Text style={styles.rangeBandTz}>{summary.range.timezone}</Text>
                  </View>
                </View>
              </>
            )}

            <View style={pdfTheme.tableHeader} fixed>
              <View style={{ width: COL.employee }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.employee")}</Text>
              </View>
              <View style={{ width: COL.department }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.department")}</Text>
              </View>
              <View style={{ width: COL.date }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.date")}</Text>
              </View>
              <View style={{ width: COL.entry }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.entry")}</Text>
              </View>
              <View style={{ width: COL.exit }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.exit")}</Text>
              </View>
              <View style={{ width: COL.hours }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.hours")}</Text>
              </View>
              <View style={{ width: COL.incident }}>
                <Text style={pdfTheme.tableHeaderText}>{tt("columns.incident")}</Text>
              </View>
            </View>

            {pageRows.map((r, i) => (
              <View key={r.id + i} style={i % 2 === 0 ? pdfTheme.tableRow : pdfTheme.tableRowAlt}>
                <View style={{ width: COL.employee }}>
                  <Text style={pdfTheme.cellDescTitle}>{r.employeeName}</Text>
                  <Text style={pdfTheme.cellDescSub}>
                    {r.employeeNumber ? `#${r.employeeNumber}` : "—"}
                    {!r.active ? ` · ${tt("status.inactive")}` : ""}
                  </Text>
                </View>
                <View style={{ width: COL.department }}>
                  <Text style={pdfTheme.cellMuted}>{r.departmentName ?? tt("noDepartment")}</Text>
                </View>
                <View style={{ width: COL.date }}>
                  <Text style={pdfTheme.cell}>{fmtDayKey(r.date)}</Text>
                </View>
                <View style={{ width: COL.entry }}>
                  <Text style={pdfTheme.cell}>{fmtStamp(r.entryAt, meta.period, tz)}</Text>
                </View>
                <View style={{ width: COL.exit }}>
                  <Text style={pdfTheme.cell}>{fmtStamp(r.exitAt, meta.period, tz)}</Text>
                </View>
                <View style={{ width: COL.hours }}>
                  <Text style={pdfTheme.cellBold}>
                    {r.entryAt && r.exitAt ? fmtMinutes(r.workedMinutes) : "—"}
                  </Text>
                </View>
                <View style={{ width: COL.incident }}>{renderIncident(r.incident)}</View>
              </View>
            ))}

            {pageIdx === pages.length - 1 && (
              <View style={styles.totalsBar}>
                <View style={styles.totalsItem}>
                  <Text style={styles.totalsLabel}>{tt("pdf.totalPeople")}</Text>
                  <Text style={styles.totalsValue}>{summary.peopleTotal}</Text>
                </View>
                <View style={styles.totalsItem}>
                  <Text style={styles.totalsLabel}>{tt("pdf.totalHours")}</Text>
                  <Text style={styles.totalsValue}>{fmtMinutes(summary.totalWorkedMinutes)}</Text>
                </View>
                <View style={styles.totalsItem}>
                  <Text style={styles.totalsLabel}>{tt("pdf.totalIncidents")}</Text>
                  <Text style={styles.totalsValue}>{summary.totalIncidents}</Text>
                </View>
              </View>
            )}
          </View>

          <PdfFooter pageIndex={pageIdx} pageCount={pages.length} />
        </Page>
      ))}
    </Document>
  );
}
