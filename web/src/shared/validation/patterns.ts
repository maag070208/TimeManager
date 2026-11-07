/**
 * Reglas puras de los validadores de expediente (EMP-05).
 *
 * Sin i18n ni React: devuelven `boolean` para poder probarlas con `node --test`.
 * Los validadores de `shared/validation/*` las usan y solo agregan el mensaje
 * traducido, así el comportamiento queda en un solo lugar.
 */

export const trimValue = (value: string | null | undefined): string => (value ?? "").trim();

export const isBlank = (value: string | null | undefined): boolean => trimValue(value) === "";

/** Correo "obvio" (atrapa typos; no pretende ser RFC 5322 completo). */
export const isValidEmail = (value: string | null | undefined): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimValue(value));

/** RFC mexicano: persona física (13) o moral (12). Sin homoclave ni dígito verificador. */
export const isValidRfc = (value: string | null | undefined): boolean =>
  /^([A-ZÑ&]{3,4})\d{6}([A-Z0-9]{3})$/.test(trimValue(value).toUpperCase());

/** CURP: 18 alfanuméricos (4 letras, 6 dígitos de fecha y 8 alfanuméricos). */
export const isValidCurp = (value: string | null | undefined): boolean =>
  /^[A-Z]{4}\d{6}[A-Z0-9]{8}$/.test(trimValue(value).toUpperCase());

/** NSS: exactamente 11 dígitos. */
export const isValidNss = (value: string | null | undefined): boolean =>
  /^\d{11}$/.test(trimValue(value));

/** Teléfono: 10 a 13 dígitos, ignorando "+", espacios y guiones. */
export const isValidPhone = (value: string | null | undefined): boolean => {
  const digits = trimValue(value).replace(/[^\d]/g, "");
  return digits.length >= 10 && digits.length <= 13;
};

/** Código postal (México): 5 dígitos. */
export const isValidPostal = (value: string | null | undefined): boolean =>
  /^\d{5}$/.test(trimValue(value));
