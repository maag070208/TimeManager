export type KpiTone = "neutral" | "emerald" | "sky" | "amber" | "orange" | "rose" | "violet";

/** Tonos pastel del kit (`ITCard tone`); `neutral` no lleva tono (tarjeta normal). */
export type KitTone = "primary" | "secondary" | "ternary" | "success" | "info" | "warning" | "danger";

/**
 * Tono del kit y color de acento por tono. El fondo pastel y el borde los pone
 * `ITCard` según la apariencia del proveedor (bento: tarjeta sin borde; flat/soft:
 * fondo teñido con borde fino). El acento se toma del tema, oscurecido donde el
 * color puro es muy claro para un ícono sobre fondo pastel (warning, success).
 */
export const KPI_TONES: Record<KpiTone, { kit: KitTone | undefined; bg: string; accent: string }> = {
  neutral: { kit: undefined, bg: "color-mix(in srgb, #64748B 14%, transparent)", accent: "#64748B" },
  sky: { kit: "secondary", bg: "var(--color-secondary-soft)", accent: "var(--color-secondary)" },
  violet: { kit: "info", bg: "var(--color-info-soft)", accent: "var(--color-info)" },
  emerald: {
    kit: "success",
    bg: "var(--color-success-soft)",
    accent: "color-mix(in srgb, var(--color-success) 80%, #000)",
  },
  amber: {
    kit: "warning",
    bg: "var(--color-warning-soft)",
    accent: "color-mix(in srgb, var(--color-warning) 70%, #000)",
  },
  // El kit no tiene tono "alert" en ITCard: comparte el fondo de warning, con acento más cálido.
  orange: {
    kit: "warning",
    bg: "var(--color-warning-soft)",
    accent: "color-mix(in srgb, var(--color-warning) 50%, #C2410C)",
  },
  rose: { kit: "danger", bg: "var(--color-danger-soft)", accent: "var(--color-danger)" },
};
