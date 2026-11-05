import { ITSelect, ITText } from "@axzydev/axzy_ui_system";
import { LuBuilding2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useTenantSwitcher } from "../model/useTenantSwitcher";

/** Nombre del cliente en la barra superior; selector para el personal de plataforma. */
export default function TenantSwitcher() {
  const { t } = useTranslation("common");
  const { canSwitch, tenants, selectedId, currentName, select } = useTenantSwitcher();

  if (canSwitch) {
    const options = [
      { value: "", label: t("tenant.platform") },
      ...(tenants ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name })),
    ];
    return (
      <div className="w-48 max-w-[40vw]" title={t("tenant.switchHint")}>
        <ITSelect
          name="tenant"
          size="sm"
          options={options}
          value={selectedId}
          disabled={tenants === null}
          onChange={(e) => select(e.target.value)}
        />
      </div>
    );
  }

  if (!currentName) return null;
  return (
    <ITText
      as="span"
      className="hidden max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:inline-flex dark:bg-slate-800 dark:text-slate-200"
      title={t("tenant.current")}
    >
      <LuBuilding2 aria-hidden size={13} />
      {currentName}
    </ITText>
  );
}
