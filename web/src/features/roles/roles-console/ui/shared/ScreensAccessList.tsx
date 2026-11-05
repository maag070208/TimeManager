import { useMemo } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import {
  screenActions,
  screenLeaves,
  isScreenVisibleInGroup,
  type PermissionCatalog,
  type PermissionMap,
} from "@entities/permission";
import { ITText, ITStack } from "@axzydev/axzy_ui_system";

interface Props {
  permissions: PermissionMap | undefined;
  role: string;
  catalog: readonly PermissionCatalog[];
}

/**
 * Pantallas que se ven y, por pantalla, qué acciones (botones) quedan
 * habilitadas con estos permisos. Responde "ve la tabla pero no puede crear".
 */
export default function ScreensAccessList({ permissions, role, catalog }: Props) {
  const { t } = useTranslation("roles");
  const { t: tc } = useTranslation("common");
  const active = useMemo(() => catalog.filter((permission) => permission.active), [catalog]);
  const keys = useMemo(() => active.map((permission) => permission.key), [active]);
  const nameOf = (key: string) => active.find((permission) => permission.key === key)?.name ?? key;
  const leaves = useMemo(() => screenLeaves(), []);

  const visible = leaves.filter((leaf) => isScreenVisibleInGroup(permissions, leaf.screen, leaf.parent, role));
  const hidden = leaves.length - visible.length;

  if (visible.length === 0) {
    return <ITText className="py-8 text-center text-[12px] italic text-slate-400">{t("screens.empty")}</ITText>;
  }

  return (
    <ITStack spacing={1.5}>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {visible.map(({ screen, parent }, index) => {
          const actions = screenActions(screen, keys).filter((key) => keys.includes(key));
          return (
            <div
              key={screen.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 ${index > 0 ? "border-t border-slate-100" : ""}`}
            >
              <FaCheck size={9} className="shrink-0 text-emerald-500" title={t("screens.canSee")} />
              <ITText as="span" className="min-w-[160px] text-[12px] font-semibold text-slate-800">
                {parent && <ITText as="span" className="font-normal text-slate-400">{tc(parent.labelKey)} › </ITText>}
                {tc(screen.labelKey)}
              </ITText>
              {actions.length > 0 && (
                <ITText as="span" className="flex flex-1 flex-wrap justify-end gap-1">
                  {actions.map((key) => {
                    const allowed = (permissions?.[key] ?? "NONE") !== "NONE";
                    return (
                      <ITText as="span"
                        key={key}
                        title={key}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold ${
                          allowed ? "border-emerald-200 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {allowed ? <FaCheck size={7} /> : <FaTimes size={7} />}
                        {nameOf(key)}
                      </ITText>
                    );
                  })}
                </ITText>
              )}
            </div>
          );
        })}
      </div>
      {hidden > 0 && <ITText className="text-[10px] text-slate-400">{t("screens.hidden", { count: hidden })}</ITText>}
    </ITStack>
  );
}
