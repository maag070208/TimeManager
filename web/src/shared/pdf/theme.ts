import { StyleSheet } from "@react-pdf/renderer";

// Paleta de marca — el azul viene muestreado directamente del logo de
// TimeManager, así todos los PDF del sistema se sienten
// parte de la misma identidad visual.
export const PDF_COLORS = {
  band: "#0a4560",
  bandDark: "#073349",
  bandAccent: "#5fb8dd",
  ink: "#0f172a",
  muted: "#64748b",
  light: "#f1f5f9",
  border: "#e2e8f0",
  white: "#ffffff",
  success: "#15803d",
  successBg: "#dcfce7",
  warning: "#b45309",
  warningBg: "#fef3c7",
  danger: "#dc2626",
  dangerBg: "#fee2e2",
  gray: "#64748b",
  grayBg: "#e2e8f0",
};

export const pdfTheme = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: PDF_COLORS.ink,
    backgroundColor: PDF_COLORS.white,
  },
  content: {
    paddingHorizontal: 36,
    paddingTop: 18,
  },

  // ── Membrete (banda superior, se repite en cada página) ──────────────
  band: {
    backgroundColor: PDF_COLORS.band,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bandAccentLine: {
    height: 3,
    backgroundColor: PDF_COLORS.bandAccent,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PDF_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  logoImg: {
    width: 34,
    height: 34,
    objectFit: "contain",
  },
  bandTextWrap: {
    marginLeft: 10,
  },
  bandHotel: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.white,
    letterSpacing: 0.4,
  },
  bandDoc: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#bfe0f0",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  bandMetaWrap: {
    alignItems: "flex-end",
  },
  bandMeta: {
    fontSize: 7.5,
    color: "#bfe0f0",
    marginBottom: 1,
  },
  bandMetaStrong: {
    fontSize: 7.5,
    color: PDF_COLORS.white,
    fontFamily: "Helvetica-Bold",
  },

  // ── Tarjetas de resumen ────────────────────────────────────────────
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: PDF_COLORS.light,
    borderTopWidth: 2.5,
    borderTopColor: PDF_COLORS.band,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.ink,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },

  // ── Tabla ──────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.band,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.white,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    backgroundColor: "#fafbfc",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
  },
  cell: { fontSize: 7.8, color: "#334155" },
  cellBold: { fontSize: 7.8, fontFamily: "Helvetica-Bold", color: PDF_COLORS.ink },
  cellMuted: { fontSize: 7.3, color: PDF_COLORS.muted },
  cellDescTitle: { fontSize: 7.8, fontFamily: "Helvetica-Bold", color: "#334155" },
  cellDescSub: { fontSize: 6.8, color: PDF_COLORS.muted, marginTop: 1 },
  badge: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    textAlign: "center",
  },

  // ── Cajas auxiliares (filtros aplicados, etc.) ────────────────────
  filterBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 0.5,
    borderColor: PDF_COLORS.border,
    borderStyle: "solid",
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterText: {
    fontSize: 8,
    color: "#475569",
  },

  // ── Pie de página ──────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.75,
    borderTopColor: PDF_COLORS.bandAccent,
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  footerText: { fontSize: 6.8, color: PDF_COLORS.muted },
  footerPage: { fontSize: 6.8, color: PDF_COLORS.muted, fontFamily: "Helvetica-Bold" },
  footerPowered: { fontSize: 6.8, color: PDF_COLORS.band, fontFamily: "Helvetica-Bold" },
});

export const badgeStyleFor = (kind: "success" | "warning" | "danger" | "gray" | "info") => {
  const map = {
    success: { color: PDF_COLORS.success, backgroundColor: PDF_COLORS.successBg },
    warning: { color: PDF_COLORS.warning, backgroundColor: PDF_COLORS.warningBg },
    danger: { color: PDF_COLORS.danger, backgroundColor: PDF_COLORS.dangerBg },
    gray: { color: PDF_COLORS.gray, backgroundColor: PDF_COLORS.grayBg },
    info: { color: PDF_COLORS.band, backgroundColor: "#dbeafe" },
  } as const;
  return [pdfTheme.badge, map[kind]];
};
