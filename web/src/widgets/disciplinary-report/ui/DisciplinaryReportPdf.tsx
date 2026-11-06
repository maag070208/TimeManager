import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatDate } from "@shared/utils/dates";
import { useTranslation } from "react-i18next";
import type { DisciplinaryReport } from "@entities/hr";
import { LOGO_CHECKLAB_BASE64 } from "@shared/assets/logoCheckLab";

interface Props {
  disciplinaryReport: DisciplinaryReport;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingLeft: 32,
    paddingRight: 14,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#000",
    backgroundColor: "#fff",
    lineHeight: 1.2,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  logoBox: { flexDirection: "row", alignItems: "center" },
  logo: { width: 80, height: 80 },
  metaBox: {
    borderWidth: 0.8,
    borderColor: "#000",
    borderStyle: "solid",
    width: 200,
    padding: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  metaLabel: { width: 60, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  metaVal: {
    flex: 1,
    textAlign: "center",
    borderBottomWidth: 0.8,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    fontSize: 8.5,
    paddingBottom: 1,
    minHeight: 10,
  },
  titleBar: {
    backgroundColor: "#d9d9d9",
    borderWidth: 0.8,
    borderColor: "#000",
    borderStyle: "solid",
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontSize: 11,
    textAlign: "center",
  },
  principalBlock: {
    borderWidth: 0.8,
    borderColor: "#000",
    borderStyle: "solid",
    borderTopWidth: 0,
    padding: 6,
  },
  paragraph: {
    marginBottom: 4,
    textAlign: "justify",
    lineHeight: 1.3,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  data: { marginTop: 3, marginBottom: 4 },
  datumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  datumLabel: { width: 95, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  datumVal: {
    flex: 1,
    borderBottomWidth: 0.8,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    fontSize: 8.5,
    paddingLeft: 3,
    paddingBottom: 0,
    minHeight: 10,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 2,
    marginTop: 3,
  },
  description: {
    borderWidth: 0.6,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 4,
    fontSize: 8.5,
    lineHeight: 1.35,
    textAlign: "justify",
    minHeight: 40,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 30,
  },
  signatureBox: { width: 140, alignItems: "center" },
  signatureLine: {
    width: "100%",
    borderTopWidth: 0.8,
    borderTopColor: "#000",
    borderTopStyle: "solid",
    marginBottom: 1.5,
  },
  signatureLabel: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  signatureName: { fontSize: 8 },
});

export default function DisciplinaryReportPdf({ disciplinaryReport }: Props) {
  const { t: tt } = useTranslation("disciplinary-reports");
  const disciplinaryReportDate = formatDate(disciplinaryReport.createdAt) || "";
  const incidentDate = formatDate(disciplinaryReport.incidentDate) || "";
  const employee = disciplinaryReport.user.name;
  const area = disciplinaryReport.user.department?.name
    ? `${disciplinaryReport.user.department.name}${disciplinaryReport.user.subarea ? ` — ${disciplinaryReport.user.subarea.name}` : ""}`
    : "—";
  const signatureRh = disciplinaryReport.createdBy.name || "—";

  return (
    <Document title={tt("doc.documentTitle")} author="CheckLab">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topHeader}>
          <View style={styles.logoBox}>
            <Image src={LOGO_CHECKLAB_BASE64} style={styles.logo} />
          </View>
          <View style={styles.metaBox}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{tt("doc.date")}</Text>
              <Text style={styles.metaVal}>{disciplinaryReportDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{tt("doc.employee")}</Text>
              <Text style={styles.metaVal}>{employee}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{tt("doc.reason")}</Text>
              <Text style={styles.metaVal}>{tt(`reasons.${disciplinaryReport.reason}`)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.titleBar}>
          <Text>{tt("doc.documentTitle")}</Text>
        </View>

        <View style={styles.principalBlock}>
          <Text style={styles.paragraph}>
            {tt("doc.para1a")}{" "}
            <Text style={styles.bold}>{employee}</Text>{" "}
            {tt("doc.para1b")}{" "}
            <Text style={styles.bold}>{tt(`reasons.${disciplinaryReport.reason}`)}</Text>{" "}
            {tt("doc.para1c")} <Text style={styles.bold}>{incidentDate}</Text>{" "}
            {tt("doc.para1d")}
          </Text>

          <View style={styles.data}>
            <View style={styles.datumRow}>
              <Text style={styles.datumLabel}>{tt("doc.employee")}</Text>
              <Text style={styles.datumVal}>{employee}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumLabel}>{tt("doc.employeeNumber")}</Text>
              <Text style={styles.datumVal}>{disciplinaryReport.user.employeeNumber ?? "—"}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumLabel}>{tt("doc.jobTitle")}</Text>
              <Text style={styles.datumVal}>{disciplinaryReport.user.jobTitle ?? "—"}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumLabel}>{tt("doc.department")}</Text>
              <Text style={styles.datumVal}>{area}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumLabel}>{tt("doc.reason")}</Text>
              <Text style={styles.datumVal}>{tt(`reasons.${disciplinaryReport.reason}`)}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumLabel}>{tt("doc.incidentDate")}</Text>
              <Text style={styles.datumVal}>{incidentDate}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{tt("doc.description")}</Text>
          <Text style={styles.description}>{disciplinaryReport.description}</Text>

          {disciplinaryReport.sanction && (
            <>
              <Text style={styles.sectionTitle}>{tt("doc.sanction")}</Text>
              <Text style={styles.description}>{disciplinaryReport.sanction}</Text>
            </>
          )}

          <Text style={{ ...styles.paragraph, marginTop: 6, marginBottom: 0 }}>
            {tt("doc.closing")}
          </Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{employee}</Text>
            <Text style={styles.signatureLabel}>{tt("doc.signatureEmployee")}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName} />
            <Text style={styles.signatureLabel}>{tt("doc.signatureHead")}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{signatureRh}</Text>
            <Text style={styles.signatureLabel}>{tt("doc.signatureRh")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}