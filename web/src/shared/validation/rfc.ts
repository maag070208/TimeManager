import { i18n } from "@shared/i18n";
import { isValidRfc } from "./patterns";

/**
 * Lite RFC validator (Mexico). Allows null/empty.
 * Returns null when valid, otherwise a translated error message.
 */
export const validateRfc = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  return isValidRfc(value) ? null : i18n.t("common:validation.invalidRfc");
};
