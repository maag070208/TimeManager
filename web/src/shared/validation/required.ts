import { i18n } from "@shared/i18n";

/** Non-empty helper. Returns null when valid, otherwise a translated error message. */
export const validateRequired = (
  value: string | null | undefined,
  label = i18n.t("common:validation.thisField")
): string | null => {
  if (value == null || value.trim() === "") return i18n.t("common:validation.required", { label });
  return null;
};

/** Minimum-length helper for strings. */
export const validateMinLength = (
  value: string | null | undefined,
  min: number,
  label = i18n.t("common:validation.thisField")
): string | null => {
  if (value == null || value.trim() === "") return i18n.t("common:validation.required", { label });
  return value.length >= min ? null : i18n.t("common:validation.minLength", { label, min });
};
