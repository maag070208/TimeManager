import { ITSegmentedControl, ITText } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import type { PermissionCatalog } from "@entities/permission";
import type { PermissionScope } from "@entities/user";
import { grantableScopes, isScopedPermission } from "../../model/access-levels";
import { SCOPE_STYLE } from "./tokens";

/** Insignia del alcance: "Solo lo suyo · Su área · Todo" o "Sí" en los de sí/no. */
export function ScopeChip({ scope, scoped = true }: { scope: PermissionScope; scoped?: boolean }) {
  const { t } = useTranslation("roles");
  return (
    <ITText as="span"
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${SCOPE_STYLE[scope]}`}
    >
      {scope === "NONE" ? t("scopePlain.NONE") : scoped ? t(`scopePlain.${scope}`) : t("matrix.granted")}
    </ITText>
  );
}

interface PickerProps {
  permission: PermissionCatalog;
  value: PermissionScope;
  onChange: (scope: PermissionScope) => void;
  disabled?: boolean;
}

/** Selector en línea de Propio / Área / Todo (solo para permisos con alcance de datos). */
export function ScopePicker({ permission, value, onChange, disabled }: PickerProps) {
  const { t } = useTranslation("roles");
  if (!isScopedPermission(permission)) return null;
  return (
    <ITSegmentedControl
      size="sm"
      disabled={disabled}
      value={value}
      onChange={(next) => onChange(next as PermissionScope)}
      options={grantableScopes(permission).map((scope) => ({ value: scope, label: t(`scope.${scope}`) }))}
    />
  );
}
