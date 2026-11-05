import type { ScheduleDayInput } from "@entities/schedule";

const toMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** Espeja la fórmula del backend (`horario.service.ts`): `diff > 0 ? diff : diff + 1440`. */
export const minutesBetween = (from: string | null, to: string | null): number => {
  if (!from || !to) return 0;
  const diff = toMinutes(to) - toMinutes(from);
  return diff > 0 ? diff : diff + 24 * 60;
};

/** Minutos de la jornada de un día, descontando la comida. `0` si es descanso. */
export const dayMinutes = (d: ScheduleDayInput, mealBreakMin: number): number => {
  if (d.restDay) return 0;
  const span = minutesBetween(d.startTime ?? null, d.endTime ?? null);
  const second = d.splitStartTime && d.splitEndTime ? minutesBetween(d.splitStartTime, d.splitEndTime) : 0;
  return Math.max(0, span + second - mealBreakMin);
};

/** Suma de minutos de todos los días de la semana. */
export const weeklyMinutes = (days: ScheduleDayInput[], mealBreakMin: number): number =>
  days.reduce((total, d) => total + dayMinutes(d, mealBreakMin), 0);

/** Cantidad de días marcados como laborables. */
export const daysWorked = (days: ScheduleDayInput[]): number =>
  days.filter((d) => !d.restDay).length;

/** Cantidad de días marcados como descanso. */
export const restDays = (days: ScheduleDayInput[]): number =>
  days.filter((d) => d.restDay).length;
