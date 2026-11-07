import { i18n } from "@shared/i18n";
import { isValidCurp } from "./patterns";

/**
 * Lite CURP validator (18 alfanuméricos). Allows null/empty.
 */
export const validateCurp = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  return isValidCurp(value) ? null : i18n.t("common:validation.invalidCurp");
};
