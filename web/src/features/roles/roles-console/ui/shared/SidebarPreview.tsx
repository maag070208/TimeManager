import { useTranslation } from "react-i18next";
import { APP_SCREENS, isScreenVisible, type AppScreen, type PermissionMap } from "@entities/permission";
import { ITText } from "@axzydev/axzy_ui_system";

interface Props {
  permissions: PermissionMap | undefined;
  /** Rol principal (para las pantallas de regla fija, p. ej. "Mis tareas"). */
  role: string;
  /** Nombre que se muestra en la barra superior de la maqueta. */
  title: string;
}

/**
 * Maqueta del menú lateral tal como lo vería un rol o una persona: misma
 * fuente (`APP_SCREENS`) y misma regla de visibilidad que `PrivateRoutes`.
 */
export default function SidebarPreview({ permissions, role, title }: Props) {
  const { t } = useTranslation("roles");
  const { t: tc } = useTranslation("common");
  const visible = (screen: AppScreen) => isScreenVisible(permissions, screen, role);
  const groups = APP_SCREENS.filter(visible);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-[var(--it-card-bg)]">
      <div className="flex items-center gap-2 bg-primary-500 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--it-card-bg)]/40" />
        <ITText as="span" className="truncate text-[11px] font-bold text-white">{title}</ITText>
      </div>
      <div className="max-h-[460px] overflow-y-auto px-2 py-2">
        {groups.length === 0 ? (
          <ITText className="px-2 py-6 text-center text-[11px] italic text-slate-400">{t("screens.menuEmpty")}</ITText>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="mb-1">
              <div className="flex items-center gap-2 rounded-md px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                <ITText as="span" className="text-[11px] font-bold text-slate-800">{tc(group.labelKey)}</ITText>
              </div>
              {group.children?.filter(visible).map((child) =>
                child.children?.length ? (
                  <div key={child.id} className="ml-4 mt-1">
                    <ITText className="px-2 pb-0.5 pt-1 text-[12px] font-semibold text-slate-400">
                      {tc(child.labelKey)}
                    </ITText>
                    {child.children.filter(visible).map((leaf) => (
                      <ITText key={leaf.id} className="truncate rounded-md px-2 py-0.5 text-[11px] text-slate-600">
                        {tc(leaf.labelKey)}
                      </ITText>
                    ))}
                  </div>
                ) : (
                  <ITText key={child.id} className="ml-4 truncate rounded-md px-2 py-0.5 text-[11px] text-slate-600">
                    {tc(child.labelKey)}
                  </ITText>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
