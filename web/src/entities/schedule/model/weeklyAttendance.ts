import { dateLocale } from "@shared/i18n";
import { formatMinutesAsHhMm, formatTimeInTZ } from "@shared/utils/dates";
import type {
  WeeklyAttendanceApproval,
  WeeklyAttendanceDayStatus,
  WeeklyAttendanceDetailRow,
  WeeklyAttendanceReport,
} from "./types";

/**
 * Formato y colores del reporte semanal de asistencia, compartidos por la
 * pantalla, el PDF y el Excel (los tres deben verse igual que el control que
 * RH llevaba en Excel: sin información amarillo, horas extra verde, falta
 * naranja).
 */

/** Colores por estado del día (hex: sirven igual para CSS y para react-pdf). */
export const WEEKLY_STATUS_COLORS: Record<WeeklyAttendanceDayStatus, { background: string; text: string }> = {
  WORKED: { background: "#ffffff", text: "#1e293b" },
  OVERTIME: { background: "#ffffff", text: "#1e293b" },
  ABSENCE: { background: "#fdba74", text: "#7c2d12" },
  INCOMPLETE: { background: "#fecaca", text: "#7f1d1d" },
  REST: { background: "#e9edf2", text: "#475569" },
  REST_WORKED: { background: "#d8e6ef", text: "#0f3d5c" },
  NO_INFO: { background: "#fef08a", text: "#713f12" },
  FUTURE: { background: "#f8fafc", text: "#94a3b8" },
};

/** Fondo de la celda HE con tiempo extra. */
export const WEEKLY_OVERTIME_COLOR = "#6ee7b7";

/** Color del texto de la decisión sobre el tiempo extra. */
export const WEEKLY_APPROVAL_COLORS: Record<WeeklyAttendanceApproval, string> = {
  APPROVED: "#047857",
  PENDING: "#b45309",
  REJECTED: "#b91c1c",
};

/** Estados que se muestran como una sola celda con su nombre (sin horas). */
export const WEEKLY_MERGED_STATUSES: WeeklyAttendanceDayStatus[] = ["ABSENCE", "REST", "NO_INFO", "FUTURE"];

/** Orden de la simbología. */
export const WEEKLY_LEGEND: WeeklyAttendanceDayStatus[] = ["NO_INFO", "OVERTIME", "ABSENCE", "INCOMPLETE", "REST", "REST_WORKED"];

/** Color de `ITBadget` por estado del día (tabla y simbología). */
export type WeeklyBadgeColor = "success" | "warning" | "danger" | "gray" | "info";

export const WEEKLY_STATUS_BADGE: Record<WeeklyAttendanceDayStatus, WeeklyBadgeColor> = {
  WORKED: "gray",
  OVERTIME: "success",
  ABSENCE: "warning",
  INCOMPLETE: "danger",
  REST: "gray",
  REST_WORKED: "info",
  NO_INFO: "warning",
  FUTURE: "gray",
};

/** Color de `ITBadget` por decisión de tiempo extra. */
export const WEEKLY_APPROVAL_BADGE: Record<WeeklyAttendanceApproval, WeeklyBadgeColor> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
};

/** Minutos → horas decimales como en el Excel (`8.55`). */
export const hoursDecimal = (minutes: number): string => (minutes / 60).toFixed(2);

/** Minutos → `h:mm` (T.T del Excel). */
export const workedTime = (minutes: number): string => formatMinutesAsHhMm(minutes).replace(/^0(\d)/, "$1");

/** Día local `YYYY-MM-DD` de un instante en la zona del reporte. */
export const dayKeyInZone = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone });

/** Hora de una checada en la zona del reporte, con `+1` si cae al día siguiente del día del renglón. */
export const punchTime = (iso: string | null, dayKey: string, timeZone: string): string => {
  if (!iso) return "—";
  const time = formatTimeInTZ(iso, timeZone);
  return dayKeyInZone(iso, timeZone) > dayKey ? `${time} +1` : time;
};

/** Encabezado del día: "MIÉ 16". */
export const dayHeader = (dayKey: string): string =>
  new Date(`${dayKey}T12:00:00Z`)
    .toLocaleDateString(dateLocale(), { weekday: "short", day: "2-digit", timeZone: "UTC" })
    .replace(/\./g, "")
    .toUpperCase();

/** Fecha corta "16/09/2026" de una clave de día. */
export const dayLabel = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
};

/** Clave local `YYYY-MM-DD` de un Date del navegador (el día que el usuario eligió). */
export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Renglón del resumen por departamento de la pre-nómina. */
export interface WeeklyDepartmentRow {
  departmentId: string | null;
  name: string;
  people: number;
  /** Horas trabajadas sin contar el tiempo extra. */
  normalMin: number;
  extraMin: number;
  approvedExtraMin: number;
  absences: number;
}

/**
 * Resumen por departamento del reporte semanal (la tabla principal de la
 * pre-nómina): personas, horas normales, horas extra y faltas, ordenado por
 * nombre. Los departamentos sin nombre caen en "—".
 */
export const buildDepartmentRows = (report: WeeklyAttendanceReport): WeeklyDepartmentRow[] => {
  const byDept = new Map<string, WeeklyDepartmentRow>();
  for (const row of report.rows) {
    const key = row.departmentId ?? "";
    const agg =
      byDept.get(key) ??
      ({
        departmentId: row.departmentId,
        name: row.departmentName ?? "—",
        people: 0,
        normalMin: 0,
        extraMin: 0,
        approvedExtraMin: 0,
        absences: 0,
      } satisfies WeeklyDepartmentRow);
    agg.people += 1;
    agg.normalMin += Math.max(0, row.totals.workedMin - row.totals.extraMin);
    agg.extraMin += row.totals.extraMin;
    agg.approvedExtraMin += row.totals.approvedExtraMin;
    agg.absences += row.totals.absences;
    byDept.set(key, agg);
  }
  return [...byDept.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
};

/**
 * Filas de la vista Detallada: una por persona y día, en el orden del reporte.
 * La comparten la tabla y el PDF para que el export salga igual que la pantalla.
 */
export const buildDetailRows = (report: WeeklyAttendanceReport): WeeklyAttendanceDetailRow[] =>
  report.rows.flatMap((r) =>
    r.days.map((day) => ({
      userId: r.userId,
      clock: r.clockNumbers.join(", ") || r.employeeNumber || "—",
      name: r.name,
      departmentName: r.departmentName,
      day,
    }))
  );
