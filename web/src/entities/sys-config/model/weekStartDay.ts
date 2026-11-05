import { useEffect, useState } from "react";
import { sysConfigApi } from "../api/sysConfigApi";

/**
 * Primer día de la semana laboral (`sys_config.WEEK_START_DAY`).
 *
 * El cliente opera miércoles→miércoles: los filtros de periodo (`Diaria /
 * Semanal / Mensual`) muestran la semana según este día y el API calcula el
 * mismo borde. Aquí solo se usa para etiquetas y rangos de UI; la fuente de
 * verdad de los datos es el API.
 */

/** Nombres de día, en el orden de `Date.getDay()` (domingo=0 … sábado=6). */
export const WEEKDAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** Fallback de la app cuando la clave no existe o es inválida: miércoles. */
export const DEFAULT_WEEK_START_DAY: Weekday = "WEDNESDAY";

/** `true` si `value` es un nombre de día válido (sin distinguir mayúsculas). */
export const isWeekday = (value: unknown): value is Weekday =>
  typeof value === "string" &&
  (WEEKDAYS as readonly string[]).includes(value.trim().toUpperCase());

/** Índice JS (`0`=domingo … `6`=sábado) del día. */
export const weekdayIndex = (day: Weekday): number => WEEKDAYS.indexOf(day);

let cached: number | null = null;
let pending: Promise<number> | null = null;

/**
 * Lee (y cachea a nivel de módulo) el primer día de la semana. Si la clave no
 * existe —o la petición falla— cae en el default sin romper la pantalla.
 */
export const loadWeekStartDay = (): Promise<number> => {
  if (cached !== null) return Promise.resolve(cached);
  pending ??= sysConfigApi
    .getWeekStartDay()
    .then((row) => {
      const idx = isWeekday(row.value)
        ? weekdayIndex(row.value)
        : weekdayIndex(DEFAULT_WEEK_START_DAY);
      cached = idx;
      return idx;
    })
    .catch(() => weekdayIndex(DEFAULT_WEEK_START_DAY))
    .finally(() => {
      pending = null;
    });
  return pending;
};

/** Invalida el cache (después de guardar el valor en el panel admin). */
export const invalidateWeekStartDay = (): void => {
  cached = null;
};

/** Primer día de la semana como índice JS (`0`…`6`), reactivo al cache. */
export const useWeekStartDay = (): number => {
  const [day, setDay] = useState<number>(
    cached ?? weekdayIndex(DEFAULT_WEEK_START_DAY)
  );

  useEffect(() => {
    let alive = true;
    void loadWeekStartDay().then((idx) => {
      if (alive) setDay(idx);
    });
    return () => {
      alive = false;
    };
  }, []);

  return day;
};
