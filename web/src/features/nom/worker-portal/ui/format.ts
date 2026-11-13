import { dateLocale } from "@shared/i18n";

/** `t` del namespace `nom` con llaves dinámicas. */
export type Tr = (key: string, vars?: Record<string, unknown>) => string;

export interface PortalCardProps {
  className?: string;
  tr: Tr;
}

export const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });

export const dayOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });

export const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" });

export const sameDay = (iso: string): boolean => new Date(iso).toDateString() === new Date().toDateString();

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
