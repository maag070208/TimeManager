import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { useTranslation } from "react-i18next";
import type { PayrollClosureRow } from "@entities/schedule";
import { PDF_COLORS, pdfTheme } from "@shared/pdf/theme";
import { dyn } from "@shared/i18n/dyn";
import PdfLetterhead from "@shared/pdf/PdfLetterhead";
import PdfFooter from "@shared/pdf/PdfFooter";

const styles = StyleSheet.create({
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 6.3,
    color: "#64748b",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: { fontSize: 9.5, color: "#1e293b", fontFamily: "Helvetica-Bold" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  headerCell: { fontSize: 6.6, color: "#64748b", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  deptRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  deptCell: { fontSize: 8.5, color: "#1e293b", fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  cell: { fontSize: 8, color: "#334155" },
  cellName: { fontSize: 8, color: "#1e293b" },
  cellClock: { fontSize: 6.5, color: "#94a3b8" },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 2,
    backgroundColor: "#f8fafc",
  },
  totalsCell: { fontSize: 8.5, color: "#1e293b", fontFamily: "Helvetica-Bold" },
});

// Anchos en puntos (LETTER vertical ≈ 540 útiles). Deben sumar ≈ 540.
const COL = { name: 200, hours: 90, extra: 90, approved: 90, absences: 70 };

const fmtHours = (minutes: number): string => (minutes / 60).toFixed(2);

export interface PayrollClosurePdfProps {
  closure: PayrollClosureRow;
  /** Etiqueta de la semana ("29 oct – 4 nov"). */
  weekLabel: string;
  generatedAt: string;
}

/**
 * El cierre de una semana de pre-nómina, desde la fotografía guardada al
 * cerrar: quién la cerró y, por departamento, el detalle por persona de ese
 * momento (los cierres sin detalle guardado solo muestran el resumen).
 */
export default function PayrollClosurePdf({ closure, weekLabel, generatedAt }: PayrollClosurePdfProps) {
  const { t: tr } = useTranslation("weekly-attendance");
  const t = dyn(tr);
  const departments = closure.snapshot?.departments ?? [];
  const people = closure.snapshot?.people ?? [];
  const summary = closure.snapshot?.summary;

  const info = [
    { label: t("history.week"), value: weekLabel },
    { label: t("history.closedBy"), value: closure.closedBy?.name ?? "—" },
    {
      label: t("history.closedAt"),
      value: new Date(closure.closedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    },
    { label: t("history.status"), value: t(closure.closed ? "history.closed" : "history.reopened") },
  ];

  const header = [
    { label: t("columns.employee"), width: COL.name },
    { label: t("columns.hours"), width: COL.hours, center: true },
    { label: t("columns.overtime"), width: COL.extra, center: true },
    { label: t("columns.approved"), width: COL.approved, center: true },
    { label: t("columns.absences"), width: COL.absences, center: true },
  ];

  return (
    <Document>
      <Page size="LETTER" style={pdfTheme.page}>
        <PdfLetterhead title={t("history.pdfTitle")} generatedAt={generatedAt} />

        <View style={styles.info}>
          {info.map((item) => (
            <View key={item.label}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.headerRow}>
          {header.map((col) => (
            <Text key={col.label} style={[styles.headerCell, { width: col.width, textAlign: col.center ? "center" : "left" }]}>
              {col.label}
            </Text>
          ))}
        </View>

        {departments.map((dept) => {
          const deptPeople = people.filter((p) => p.departmentId === dept.departmentId);
          return (
            <View key={dept.departmentId ?? "none"}>
              {/* Renglón del departamento con sus totales. */}
              <View style={styles.deptRow} wrap={false}>
                <Text style={[styles.deptCell, { width: COL.name }]}>
                  {dept.name} · {dept.people}
                </Text>
                <Text style={[styles.deptCell, { width: COL.hours, textAlign: "center" }]}>
                  {fmtHours(dept.normalMin + dept.extraMin)}
                </Text>
                <Text style={[styles.deptCell, { width: COL.extra, textAlign: "center" }]}>{fmtHours(dept.extraMin)}</Text>
                <Text style={[styles.deptCell, { width: COL.approved, textAlign: "center" }]}>
                  {fmtHours(dept.approvedExtraMin)}
                </Text>
                <Text style={[styles.deptCell, { width: COL.absences, textAlign: "center" }]}>{dept.absences}</Text>
              </View>
              {/* El detalle por persona (si el cierre lo guardó). */}
              {deptPeople.map((person, j) => (
                <View key={`${dept.departmentId ?? "none"}-${j}`} style={styles.row} wrap={false}>
                  <View style={{ width: COL.name, paddingLeft: 10 }}>
                    <Text style={styles.cellName}>{person.name}</Text>
                    {person.clock !== "" && <Text style={styles.cellClock}>{person.clock}</Text>}
                  </View>
                  <Text style={[styles.cell, { width: COL.hours, textAlign: "center" }]}>{fmtHours(person.workedMin)}</Text>
                  <Text style={[styles.cell, { width: COL.extra, textAlign: "center" }]}>{fmtHours(person.extraMin)}</Text>
                  <Text style={[styles.cell, { width: COL.approved, textAlign: "center" }]}>
                    {fmtHours(person.approvedExtraMin)}
                  </Text>
                  <Text style={[styles.cell, { width: COL.absences, textAlign: "center" }]}>{person.absences}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {summary && (
          <View style={styles.totalsRow} wrap={false}>
            <Text style={[styles.totalsCell, { width: COL.name }]}>{t("columns.total")}</Text>
            <Text style={[styles.totalsCell, { width: COL.hours, textAlign: "center" }]}>
              {summary.workedMin !== undefined ? fmtHours(summary.workedMin) : "—"}
            </Text>
            <Text style={[styles.totalsCell, { width: COL.extra, textAlign: "center" }]}>
              {summary.extraMin !== undefined ? fmtHours(summary.extraMin) : "—"}
            </Text>
            <Text style={[styles.totalsCell, { width: COL.approved, textAlign: "center" }]}>
              {summary.approvedExtraMin !== undefined ? fmtHours(summary.approvedExtraMin) : "—"}
            </Text>
            <Text style={[styles.totalsCell, { width: COL.absences, textAlign: "center" }]}>{summary.absences ?? "—"}</Text>
          </View>
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
}
