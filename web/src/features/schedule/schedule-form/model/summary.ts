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

/** Comida que se descuenta ese día: su ventana si tiene, si no los minutos del horario (como `mealMinutesOf` del API). */
export const mealMinutes = (d: ScheduleDayInput, mealBreakMin: number): number =>
  d.mealStartTime && d.mealEndTime ? minutesBetween(d.mealStartTime, d.mealEndTime) : mealBreakMin;

/** Minutos de la jornada de un día, descontando la comida. `0` si es descanso. */
export const dayMinutes = (d: ScheduleDayInput, mealBreakMin: number): number => {
  if (d.restDay) return 0;
  const span = minutesBetween(d.startTime ?? null, d.endTime ?? null);
  const second = d.splitStartTime && d.splitEndTime ? minutesBetween(d.splitStartTime, d.splitEndTime) : 0;
  return Math.max(0, span + second - mealMinutes(d, mealBreakMin));
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

/** Iniciales de lunes a domingo (`weekday` 1–7). */
export const DAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"] as const;

/**
 * Nombre propuesto para un horario mientras no lo escriban a mano:
 * "L–S 08:00–16:00" si los días laborales son seguidos y con la misma hora,
 * "L M V" si no son seguidos, sin horas si cambian de un día a otro.
 */
export const suggestedName = (days: ScheduleDayInput[]): string => {
  const work = days.filter((day) => !day.restDay);
  if (work.length === 0) return "";
  const first = work[0];
  const same = work.every((day) => day.startTime === first.startTime && day.endTime === first.endTime);
  const numbers = work.map((day) => day.weekday);
  const consecutive = numbers.every((n, index) => index === 0 || n === numbers[index - 1] + 1);
  const span =
    consecutive && numbers.length > 1
      ? `${DAY_INITIALS[numbers[0] - 1]}–${DAY_INITIALS[numbers[numbers.length - 1] - 1]}`
      : numbers.map((n) => DAY_INITIALS[n - 1]).join(" ");
  return same ? `${span} ${first.startTime}–${first.endTime}` : span;
};
