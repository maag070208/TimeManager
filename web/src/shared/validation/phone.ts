import { i18n } from "@shared/i18n";
import { isValidPhone } from "./patterns";

/**
 * Phone validator: 10 a 13 dígitos, permite prefijo "+" y espacios. Allows null/empty.
 */
export const validatePhone = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  return isValidPhone(value) ? null : i18n.t("common:validation.invalidPhone");
};
