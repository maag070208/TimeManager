import { i18n } from "@shared/i18n";
import { isValidEmail } from "./patterns";

/**
 * Lite email validator (RFC-5322-ish). Allows null/empty.
 * Intentionally permissive; the goal is to catch obvious typos, not fully
 * conform to RFC 5322 (which would be a much longer regex).
 */
export const validateEmail = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  return isValidEmail(value) ? null : i18n.t("common:validation.invalidEmail");
};
