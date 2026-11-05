import { i18n } from "@shared/i18n";

/** NSS lite: 11 dígitos. Allows null/empty. */
export const validateNss = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  const v = value.trim();
  return /^\d{11}$/.test(v) ? null : i18n.t("common:validation.invalidNss");
};
