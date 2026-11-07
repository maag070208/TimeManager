import { i18n } from "@shared/i18n";
import { isValidNss } from "./patterns";

/** NSS lite: 11 dígitos. Allows null/empty. */
export const validateNss = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === "") return null;
  return isValidNss(value) ? null : i18n.t("common:validation.invalidNss");
};
