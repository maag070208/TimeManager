import { i18n } from "@shared/i18n";

/**
 * Phone validator: 10 a 13 dígitos, permite prefijo "+" y espacios. Allows null/empty.
 */
export const validatePhone = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 13) {
    return i18n.t("common:validation.invalidPhone");
  }
  return null;
};
