import type { ComponentProps, ReactNode } from "react";
import { ITPage as BaseITPage } from "@axzydev/axzy_ui_system";
import { LuLayoutDashboard } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import type { ITBreadcrumbItem } from "@axzydev/axzy_ui_system";
import { useBreadcrumbTrail, type TrailState } from "@shared/lib/breadcrumb-trail";

const PAGE_CLASS = "m-0! mx-auto! max-w-[1600px]! px-6! bg-white mb-8! pb-12! min-h-[calc(100dvh-64px)]";
const HOME_PATHS = new Set(["/", "/home"]);

type BaseProps = ComponentProps<typeof BaseITPage>;

interface Props extends Omit<BaseProps, "breadcrumbs" | "description" | "icon"> {
  breadcrumbs?: ITBreadcrumbItem[];
  description?: string;
  icon?: ReactNode;
}

/**
 * `ITPage` de producto: mismo layout en todas las pantallas (1600 px centrado,
 * fondo slate y sin padding), con breadcrumbs/descripción/icono por defecto.
 *
 * Las migajas tienen memoria: si se llegó desde otra pantalla (no desde el
 * menú), muestran el camino recorrido —p. ej. Inicio › Karla— en lugar de la
 * jerarquía fija de la página; cada migaja vuelve a esa pantalla con sus filtros.
 */
export default function ITPage({
  breadcrumbs,
  description,
  icon,
  title,
  ...props
}: Props) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const homeLabel = t("breadcrumbs.home");
  const fixed: ITBreadcrumbItem[] = breadcrumbs ?? [
    { label: homeLabel, onClick: () => navigate("/") },
    ...(title ? [{ label: title }] : []),
  ];
  const ownLabel = HOME_PATHS.has(pathname) ? homeLabel : fixed[fixed.length - 1]?.label ?? (typeof title === "string" ? title : "");
  const trail = useBreadcrumbTrail(ownLabel);

  const remembered = trail.filter((crumb) => crumb.label !== ownLabel);
  const crumbs: ITBreadcrumbItem[] =
    remembered.length > 0 && !HOME_PATHS.has(pathname)
      ? [
          ...remembered.map((crumb, index) => ({
            label: crumb.label,
            onClick: () => navigate(crumb.path, { state: { trail: remembered.slice(0, index) } satisfies TrailState }),
          })),
          { label: ownLabel },
        ]
      : fixed;

  return (
    <BaseITPage
      {...props}
      title={title}
      className={PAGE_CLASS}
      noPadding
      breadcrumbs={crumbs}
      description={description ?? (title ? t("page.description", { title }) : undefined)}
      icon={icon ?? <LuLayoutDashboard size={20} />}
    />
  );
}
