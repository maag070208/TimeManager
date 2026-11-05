import { i18n } from "@shared/i18n";

/**
 * Lite RFC validator (Mexico). Allows null/empty.
 * Returns null when valid, otherwise a translated error message.
 */
export const validateRfc = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  const v = value.trim().toUpperCase();
  // Persona física (13) o moral (12). No validamos homoclave ni dígito verificador.
  const regex = /^([A-ZÑ&]{3,4})\d{6}([A-Z0-9]{3})$/;
  return regex.test(v) ? null : i18n.t("common:validation.invalidRfc");
};
