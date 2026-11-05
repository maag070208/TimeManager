import { i18n } from "@shared/i18n";

/**
 * Lite CURP validator (18 alfanuméricos). Allows null/empty.
 */
export const validateCurp = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  const v = value.trim().toUpperCase();
  const regex = /^[A-Z]{4}\d{6}[A-Z0-9]{8}$/;
  return regex.test(v) ? null : i18n.t("common:validation.invalidCurp");
};
