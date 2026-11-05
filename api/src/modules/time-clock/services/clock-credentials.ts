import { env } from "@core/config/env.config";
import { decryptSecret } from "@core/utils/crypto";
import { logger } from "@core/utils/logger";

/** Usuario y contraseña para conectarse a un reloj. */
export interface TimeClockCredentials {
  user: string;
  pass: string;
}

/** Campos del reloj con los que se resuelven sus credenciales. */
export interface ClockCredentialsFields {
  serialNumber?: string;
  username?: string | null;
  passwordEncrypted?: string | null;
}

/**
 * Fallback de desarrollo/E2E: el par global de `.env`, que solo se usa cuando
 * el reloj no tiene credenciales propias.
 */
export const envClockCredentials = (): TimeClockCredentials | null =>
  env.TIME_CLOCK_USER ? { user: env.TIME_CLOCK_USER, pass: env.TIME_CLOCK_PASS } : null;

/** El reloj tiene su propio usuario y contraseña guardados. */
export const hasOwnCredentials = (clock: ClockCredentialsFields | null | undefined): boolean =>
  !!clock?.username && !!clock?.passwordEncrypted;

/**
 * Credenciales efectivas de un reloj (F1B-10): las suyas si las tiene y, si no,
 * el par global de `.env`. `null` cuando no hay ninguna de las dos: el llamador
 * decide si eso es un 503 o un intento fallido.
 */
export const credentialsOf = (
  clock: ClockCredentialsFields | null | undefined,
  fallback: TimeClockCredentials | null = envClockCredentials()
): TimeClockCredentials | null => {
  if (hasOwnCredentials(clock)) {
    try {
      return { user: clock!.username!.trim(), pass: decryptSecret(clock!.passwordEncrypted!) };
    } catch {
      // Sin el secreto en claro ni en el mensaje: solo el reloj que falló.
      logger.error(
        `[time-clock] ${clock?.serialNumber ?? "clock"}: stored credentials could not be decrypted (wrong ENCRYPTION_KEY?); falling back to the .env pair`
      );
    }
  } else if (clock?.username && !clock.passwordEncrypted) {
    logger.warn(
      `[time-clock] ${clock.serialNumber ?? "clock"}: username without a stored password; using the .env pair`
    );
  }
  return fallback;
};
