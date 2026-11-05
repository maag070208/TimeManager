import { useTranslation } from "react-i18next";

/** Texto del operando derecho: literal o referencia al usuario. */
export const useConditionValue = () => {
  const { t } = useTranslation("roles");
  return (value: string | null): string => {
    if (value === "@user.id") return t("policies.ref.userId");
    if (value === "@user.departmentId") return t("policies.ref.departmentId");
    if (value === "@user.role") return t("policies.ref.role");
    return value ?? "";
  };
};
