import { dateLocale } from "@shared/i18n";
import { dateKeyInTimeZone } from "@shared/utils/dates";

/** `t` del namespace `nom` con llaves dinámicas. */
export type Tr = (key: string, vars?: Record<string, unknown>) => string;

export interface PortalCardProps {
  className?: string;
  tr: Tr;
}

/**
 * Hora y día se leen en la zona del cliente (la misma con la que el API arma
 * el día y la secuencia de checadas), no en la del navegador.
 */
export const timeOf = (iso: string, timeZone?: string): string =>
  new Date(iso).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });

export const dayLabelOf = (date: Date, timeZone?: string, month: "long" | "short" = "long"): string =>
  date.toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month, timeZone });

export const dayOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });

export const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" });

export const sameDay = (iso: string, timeZone?: string): boolean =>
  dateKeyInTimeZone(new Date(iso), timeZone) === dateKeyInTimeZone(new Date(), timeZone);

export const dateStrToLocal = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

export const localToDateStr = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Instante ISO de una fecha (`YYYY-MM-DD`) y hora (`HH:mm`) leídas en la zona del cliente. */
export const zonedIso = (dateKey: string, time: string, timeZone?: string): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (!timeZone) return new Date(year, month - 1, day, hour, minute).toISOString();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(wall))
    .reduce<Record<string, number>>((acc, part) => ({ ...acc, [part.type]: Number(part.value) }), {});
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return new Date(wall - (shown - wall)).toISOString();
};
