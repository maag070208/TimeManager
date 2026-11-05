/** Periodos de los reportes con navegación (Entradas y salidas, Tiempo extra). */
export type ReportPeriod = "DAY" | "WEEK" | "FORTNIGHT" | "MONTH";

/** Orden en que se ofrecen en el segmentado. */
export const REPORT_PERIODS: ReportPeriod[] = ["DAY", "WEEK", "FORTNIGHT", "MONTH"];

/** Fecha local `YYYY-MM-DD` (día de referencia del periodo). */
export const toDateInput = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Día de referencia del periodo anterior (`step` = -1) o siguiente (`step` = 1). */
export const shiftPeriod = (date: Date, period: ReportPeriod, step: 1 | -1): Date => {
  const d = new Date(date);
  if (period === "DAY") d.setDate(d.getDate() + step);
  else if (period === "WEEK") d.setDate(d.getDate() + 7 * step);
  else if (period === "MONTH") d.setMonth(d.getMonth() + step, 1);
  // Quincena: 1–15 ↔ 16–fin de mes.
  else if (d.getDate() <= 15) d.setMonth(d.getMonth() + (step > 0 ? 0 : -1), step > 0 ? 16 : 16);
  else d.setMonth(d.getMonth() + (step > 0 ? 1 : 0), 1);
  return d;
};

/** `[inicio, fin]` del periodo que contiene `date` (la semana empieza en `weekStart`). */
export const periodRangeOf = (date: Date, period: ReportPeriod, weekStart: number): [Date, Date] => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === "DAY") return [start, start];
  if (period === "WEEK") {
    start.setDate(start.getDate() - ((start.getDay() - weekStart + 7) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [start, end];
  }
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  if (period === "MONTH") return [new Date(date.getFullYear(), date.getMonth(), 1), lastOfMonth];
  return date.getDate() <= 15
    ? [new Date(date.getFullYear(), date.getMonth(), 1), new Date(date.getFullYear(), date.getMonth(), 15)]
    : [new Date(date.getFullYear(), date.getMonth(), 16), lastOfMonth];
};
