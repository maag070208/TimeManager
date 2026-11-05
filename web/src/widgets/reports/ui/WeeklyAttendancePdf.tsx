import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { useTranslation } from "react-i18next";
import {
  WEEKLY_APPROVAL_COLORS,
  WEEKLY_MERGED_STATUSES,
  WEEKLY_STATUS_COLORS,
  dayHeader,
  dayLabel,
  hoursDecimal,
  punchTime,
  type WeeklyAttendanceDetailRow,
  type WeeklyAttendancePdfPayload,
  type WeeklyAttendanceRow,
} from "@entities/schedule";
import { PDF_COLORS, pdfTheme } from "@shared/pdf/theme";
import { dyn } from "@shared/i18n/dyn";
import PdfLetterhead from "@shared/pdf/PdfLetterhead";
import PdfFooter from "@shared/pdf/PdfFooter";

const styles = StyleSheet.create({
  band: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PDF_COLORS.band,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  bandLabel: {
    fontSize: 6.3,
    color: "#bfe0f0",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bandValue: { fontSize: 11, color: PDF_COLORS.white, fontFamily: "Helvetica-Bold" },
  dayCell: {
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    alignItems: "center",
  },
  dayRange: { fontSize: 6.8, color: "#334155" },
  dayStatus: { fontSize: 6.6 },
  incident: { fontSize: 5.6, color: "#d97706", marginTop: 1 },
});

/** Colores de texto equivalentes a las clases de la tabla (slate/emerald/amber). */
const TEXT = {
  name: "#1e293b", // slate-800
  strong: "#334155", // slate-700
  soft: "#475569", // slate-600
  muted: "#64748b", // slate-500
  faint: "#cbd5e1", // slate-300
  overtime: "#047857", // emerald-700 (HE aprob.)
  absence: "#b45309", // amber-700 (Faltas)
};

// Anchos en puntos (LETTER apaisado ≈ 720 útiles). Deben sumar ≈ 720.
const SUMMARY_COL = { code: 40, employee: 130, day: 60, total: 110 };
const DETAIL_COL = {
  employee: 150,
  day: 70,
  status: 90,
  entry: 60,
  exit: 60,
  hours: 45,
  extra: 60,
  missing: 50,
  shift: 135,
};

/**
 * Pre Nómina semanal: réplica de la tabla de la pantalla (mismas filas y
 * columnas), en estilo de reporte formal: banda institucional, tarjetas grises
 * y texto oscuro, sin los colores ni los chips de la pantalla.
 */
export default function WeeklyAttendancePdf({ report, mode, rows, meta }: WeeklyAttendancePdfPayload) {
  const { t } = useTranslation("weekly-attendance");
  const tt = dyn(t);
  const { days, timezone } = report.range;
  const title = t("pdf.title");
  const department = meta.departmentName ?? t("filters.allDepartments");
  const week = `${days[0]} — ${days[6]}`;
  const groupByDepartment = !meta.departmentName;

  const s = report.summary;
  const cards = [
    { label: t("kpis.people"), value: String(s.people) },
    { label: t("kpis.worked"), value: hoursDecimal(s.workedMin) },
    { label: t("kpis.overtime"), value: hoursDecimal(s.extraMin) },
    { label: t("kpis.approved"), value: hoursDecimal(s.approvedExtraMin) },
    { label: t("kpis.absences"), value: String(s.absences) },
    { label: t("kpis.incomplete"), value: String(s.incompleteDays) },
  ];

  const subOf = (clock: string, departmentName: string | null) =>
    groupByDepartment && departmentName ? `${clock} · ${departmentName}` : clock;

  const summaryDay = (row: WeeklyAttendanceRow, i: number) => {
    const day = row.days[i];
    if (!day || day.status === "FUTURE") {
      return (
        <View key={`d${i}`} style={[styles.dayCell, { width: SUMMARY_COL.day }]}>
          <Text style={[pdfTheme.cellMuted, { color: TEXT.faint }]}>—</Text>
        </View>
      );
    }
    if (WEEKLY_MERGED_STATUSES.includes(day.status)) {
      return (
        <View key={`d${i}`} style={[styles.dayCell, { width: SUMMARY_COL.day }]}>
          <Text style={[styles.dayStatus, { color: WEEKLY_STATUS_COLORS[day.status].text }]}>
            {tt(`statusShort.${day.status}`)}
          </Text>
        </View>
      );
    }
    const entry = day.entryAt ? punchTime(day.entryAt, day.date, timezone) : null;
    const exit = day.exitAt ? punchTime(day.exitAt, day.date, timezone) : null;
    const missingExit = !!entry && !exit;
    const missingEntry = !entry && !!exit;
    return (
      <View key={`d${i}`} style={[styles.dayCell, { width: SUMMARY_COL.day }]}>
        <Text style={styles.dayRange}>
          {entry ?? "?"} - {exit ?? "?"}
        </Text>
        {(missingExit || missingEntry) && (
          <Text style={styles.incident}>{missingExit ? t("noExit") : t("noEntry")}</Text>
        )}
      </View>
    );
  };

  const summaryRows = rows as WeeklyAttendanceRow[];
  const detailRows = rows as WeeklyAttendanceDetailRow[];

  return (
    <Document title={title} author="TimeManager">
      <Page size="LETTER" orientation="landscape" style={pdfTheme.page}>
        <View fixed>
          <PdfLetterhead title={title} generatedAt={new Date().toLocaleString("es-MX")} />
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

          <View style={styles.band}>
            <View>
              <Text style={styles.bandLabel}>{t("pdf.department")}</Text>
              <Text style={styles.bandValue}>{department}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.bandLabel}>{t("pdf.week")}</Text>
              <Text style={styles.bandValue}>{week}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.bandLabel}>{t("pdf.view")}</Text>
              <Text style={styles.bandValue}>{tt(`view.${mode.toLowerCase()}`)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.bandLabel}>{t("timezone", { tz: timezone }).split(":")[0]}</Text>
              <Text style={styles.bandValue}>{timezone}</Text>
            </View>
          </View>

          {mode === "SUMMARY" ? (
            <>
              <View style={pdfTheme.tableHeader} fixed>
                <View style={{ width: SUMMARY_COL.code }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.code")}</Text>
                </View>
                <View style={{ width: SUMMARY_COL.employee }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.employee")}</Text>
                </View>
                {days.map((day) => (
                  <View key={day} style={{ width: SUMMARY_COL.day }}>
                    <Text style={[pdfTheme.tableHeaderText, { textAlign: "center" }]}>{dayHeader(day)}</Text>
                  </View>
                ))}
                <View style={{ width: SUMMARY_COL.total }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.total")}</Text>
                </View>
              </View>

              {summaryRows.map((row, i) => (
                <View key={row.userId + i} wrap={false} style={i % 2 === 0 ? pdfTheme.tableRow : pdfTheme.tableRowAlt}>
                  <View style={{ width: SUMMARY_COL.code }}>
                    <Text style={pdfTheme.cellMuted}>{row.clockNumbers.join(", ") || row.employeeNumber || "—"}</Text>
                  </View>
                  <View style={{ width: SUMMARY_COL.employee }}>
                    <Text style={[pdfTheme.cellDescTitle, { color: TEXT.name }]}>{row.name}</Text>
                    {(!row.linked || row.withoutSchedule) && (
                      <Text style={pdfTheme.cellDescSub}>
                        {!row.linked ? t("unlinked") : t("withoutSchedule")}
                      </Text>
                    )}
                  </View>
                  {row.days.map((_day, di) => summaryDay(row, di))}
                  <View style={{ width: SUMMARY_COL.total }}>
                    <Text style={[pdfTheme.cell, { color: TEXT.strong }]}>
                      {t("columns.hours")}: {hoursDecimal(row.totals.workedMin)}
                    </Text>
                    <Text style={[pdfTheme.cell, { color: TEXT.overtime }]}>
                      {t("columns.approved")}: {hoursDecimal(row.totals.approvedExtraMin)}
                    </Text>
                    <Text style={[pdfTheme.cell, { color: TEXT.absence }]}>
                      {t("columns.absences")}: {row.totals.absences}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={pdfTheme.tableHeader} fixed>
                <View style={{ width: DETAIL_COL.employee }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.employee")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.day }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.day")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.status }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.status")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.entry }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.entry")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.exit }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.exit")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.hours }}>
                  <Text style={[pdfTheme.tableHeaderText, { textAlign: "right" }]}>{t("columns.hours")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.extra }}>
                  <Text style={[pdfTheme.tableHeaderText, { textAlign: "right" }]}>{t("columns.overtime")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.missing }}>
                  <Text style={[pdfTheme.tableHeaderText, { textAlign: "right" }]}>{t("columns.missing")}</Text>
                </View>
                <View style={{ width: DETAIL_COL.shift }}>
                  <Text style={pdfTheme.tableHeaderText}>{t("columns.shift")}</Text>
                </View>
              </View>

              {detailRows.map((row, i) => {
                const day = row.day;
                return (
                  <View
                    key={`${row.userId}-${day.date}-${i}`}
                    wrap={false}
                    style={i % 2 === 0 ? pdfTheme.tableRow : pdfTheme.tableRowAlt}
                  >
                    <View style={{ width: DETAIL_COL.employee }}>
                      <Text style={[pdfTheme.cellDescTitle, { color: TEXT.name }]}>{row.name}</Text>
                      <Text style={pdfTheme.cellDescSub}>{subOf(row.clock, row.departmentName)}</Text>
                    </View>
                    <View style={{ width: DETAIL_COL.day }}>
                      <Text style={[pdfTheme.cell, { color: TEXT.soft }]}>{dayLabel(day.date)}</Text>
                    </View>
                    <View style={{ width: DETAIL_COL.status }}>
                      <Text style={[styles.dayStatus, { color: WEEKLY_STATUS_COLORS[day.status].text }]}>
                        {tt(`status.${day.status}`)}
                      </Text>
                    </View>
                    <View style={{ width: DETAIL_COL.entry }}>
                      <Text style={pdfTheme.cell}>{punchTime(day.entryAt, day.date, timezone)}</Text>
                    </View>
                    <View style={{ width: DETAIL_COL.exit }}>
                      <Text style={pdfTheme.cell}>{punchTime(day.exitAt, day.date, timezone)}</Text>
                    </View>
                    <View style={{ width: DETAIL_COL.hours }}>
                      <Text style={[pdfTheme.cellBold, { textAlign: "right", color: TEXT.strong }]}>
                        {hoursDecimal(day.workedMin)}
                      </Text>
                    </View>
                    <View style={{ width: DETAIL_COL.extra }}>
                      <Text style={[pdfTheme.cellBold, { textAlign: "right", color: TEXT.overtime }]}>
                        {hoursDecimal(day.extraMin)}
                      </Text>
                      {day.extraMin > 0 && day.approval && (
                        <Text style={[pdfTheme.cellMuted, { textAlign: "right", color: WEEKLY_APPROVAL_COLORS[day.approval] }]}>
                          {tt(`approval.${day.approval}`)}
                        </Text>
                      )}
                    </View>
                    <View style={{ width: DETAIL_COL.missing }}>
                      <Text style={[pdfTheme.cellBold, { textAlign: "right", color: TEXT.strong }]}>
                        {hoursDecimal(day.missingMin)}
                      </Text>
                    </View>
                    <View style={{ width: DETAIL_COL.shift }}>
                      <Text style={[pdfTheme.cellMuted, { color: TEXT.muted }]}>{day.shift ?? "—"}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        <PdfFooter />
      </Page>
    </Document>
  );
}
