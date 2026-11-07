/**
 * Formato de horas y claves de día de la pre-nómina semanal (PAY-01), sin i18n
 * ni dependencias del navegador: lo comparten la tabla, el PDF y el Excel, y
 * así se puede probar con `node --test`. `entities/schedule/model/weeklyAttendance.ts`
 * reexporta estas funciones para no cambiar los imports existentes.
 */
import { formatMinutesAsHhMm } from "@shared/utils/dates";

/** Minutos → horas decimales como en el Excel (`8.55`). */
export const hoursDecimal = (minutes: number): string => (minutes / 60).toFixed(2);

/** Minutos → `h:mm` (T.T del Excel). */
export const workedTime = (minutes: number): string =>
  formatMinutesAsHhMm(minutes).replace(/^0(\d)/, "$1");

/** Clave local `YYYY-MM-DD` de un Date del navegador (el día que el usuario eligió). */
export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Fecha corta "16/09/2026" de una clave de día. */
export const dayLabel = (dayKey: string): string => {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
};
