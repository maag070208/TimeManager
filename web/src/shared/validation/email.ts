import { i18n } from "@shared/i18n";

/**
 * Lite email validator (RFC-5322-ish). Allows null/empty.
 * Intentionally permissive; the goal is to catch obvious typos, not fully
 * conform to RFC 5322 (which would be a much longer regex).
 */
export const validateEmail = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  const v = value.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(v) ? null : i18n.t("common:validation.invalidEmail");
};
