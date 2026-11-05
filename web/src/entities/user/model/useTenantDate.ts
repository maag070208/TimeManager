import { useSelector } from "react-redux";
import type { RootState } from "@app/store";
import { dateKeyInTimeZone, todayKeyInTimeZone } from "@shared/utils/dates";

/**
 * Zona horaria del cliente de la sesión (`GET /auth/me` → `tenant.timezone`).
 * `undefined` en personal de plataforma sin cliente elegido: los llamadores
 * deben caer a la zona del navegador.
 */
export const useTenantTimezone = (): string | undefined =>
  useSelector((state: RootState) => state.auth.user?.tenant?.timezone ?? undefined);

/** Clave `YYYY-MM-DD` del día de HOY en la zona del cliente. */
export const useTenantTodayKey = (): string => todayKeyInTimeZone(useTenantTimezone());

/** Clave `YYYY-MM-DD` de un instante en la zona del cliente. */
export const useTenantDateKey = (): ((date: Date) => string) => {
  const timezone = useTenantTimezone();
  return (date: Date) => dateKeyInTimeZone(date, timezone);
};
