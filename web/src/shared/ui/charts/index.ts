export { default as DonutChart } from "./DonutChart";
export { default as GaugeArc } from "./GaugeArc";
export { default as HBarChart } from "./HBarChart";
export { default as Sparkline } from "./Sparkline";
export { default as StackedBar } from "./StackedBar";
export { default as WaveFill } from "./WaveFill";

/**
 * Colores de estado de las gráficas (validados para daltonismo y contraste en
 * este orden): bien, informativo, atención, crítico.
 */
export const CHART_STATUS = {
  good: "var(--color-success)",
  info: "var(--color-secondary)",
  warning: "var(--color-warning)",
  critical: "var(--color-danger)",
} as const;

/**
 * Colores categóricos para series (una por persona, categoría o segmento).
 *
 * A diferencia de `CHART_STATUS` (que es por significado), aquí lo que importa
 * es que dos segmentos vecinos **no se parezcan**: por eso alternan cálido,
 * verde, rojo y violeta antes de repetir el azul de marca. Se cicla con `%`.
 */
export const CHART_SERIES: readonly string[] = [
  "var(--color-primary)", // #0D5777 azul de marca
  "var(--color-warning)", // #F9C74F amarillo
  "var(--color-success)", // #4ADE80 verde
  "var(--color-danger)", // #BA1A1A rojo
  "var(--color-info)", // #512bbb violeta
  "var(--color-secondary)", // #1A7499 azul claro
];

/** Color de la serie `index` (cicla). */
export const seriesColor = (index: number): string => CHART_SERIES[index % CHART_SERIES.length];
