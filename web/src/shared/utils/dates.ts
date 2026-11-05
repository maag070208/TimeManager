/** Formatea una fecha ISO a `DD/MM/AAAA`. */
export const formatDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

/** Formatea una fecha ISO a `DD/MM/AAAA HH:mm`. */
export const formatDateTime = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
};

/**
 * Hora `HH:mm` de un instante ISO en una zona horaria concreta.
 * Sin `timeZone` usa la zona del navegador. Usa `h23` para evitar `24:00`.
 */
export const formatTimeInTZ = (iso: string, timeZone?: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(iso));
};

/** Minutos trabajados → `hh:mm` legible (ej. 135 → `02:15`). */
export const formatMinutesAsHhMm = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Fecha larga con día de la semana según el idioma de la interfaz
 * (es: `miércoles 29 de octubre`; en: `Wednesday, October 29`).
 */
export const formatLongDate = (date: Date, locale: string): string => {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  const rest = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
  return locale.startsWith("es") ? `${weekday} ${rest}` : `${weekday}, ${rest}`;
};

/**
 * Clave `YYYY-MM-DD` de un instante en la zona del CLIENTE (no la del
 * navegador). La usa todo filtro "Hoy"/periodo que deba coincidir con el día
 * que resuelve la API en `sys_config.TIMEZONE`/la zona del tenant.
 * Sin `timeZone` (o con una inválida) cae a la zona del navegador.
 */
export const dateKeyInTimeZone = (date: Date, timeZone?: string | null): string => {
  const localKey = (): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  if (!timeZone) return localKey();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((p) => p.type === type)?.value ?? "";
    const key = `${part("year")}-${part("month")}-${part("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : localKey();
  } catch {
    return localKey();
  }
};

/** Clave del **hoy** del cliente en `timeZone` (fallback: navegador). */
export const todayKeyInTimeZone = (timeZone?: string | null): string =>
  dateKeyInTimeZone(new Date(), timeZone);

/**
 * `Date` a mediodía local con los campos de calendario de la clave dada. Se
 * usa para los selectores de fecha: así `toDateInput()`/los getters locales
 * devuelven el día del cliente aunque el navegador esté en otra zona.
 */
export const dateAtNoonFromKey = (key: string): Date => new Date(`${key}T12:00:00`);
