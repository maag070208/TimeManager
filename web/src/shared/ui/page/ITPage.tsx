import type { ComponentProps, ReactNode } from "react";
import { ITPage as BaseITPage } from "@axzydev/axzy_ui_system";
import { LuLayoutDashboard } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { ITBreadcrumbItem } from "@axzydev/axzy_ui_system";

const PAGE_CLASS = "m-0! mx-auto! max-w-[1600px]! px-6! bg-white mb-8 pb-12 min-h-[calc(100dvh-64px)]";

type BaseProps = ComponentProps<typeof BaseITPage>;

interface Props extends Omit<BaseProps, "breadcrumbs" | "description" | "icon"> {
  breadcrumbs?: ITBreadcrumbItem[];
  description?: string;
  icon?: ReactNode;
}

/**
 * `ITPage` de producto: mismo layout en todas las pantallas (1600 px centrado,
 * fondo slate y sin padding), con breadcrumbs/descripción/icono por defecto.
 */
export default function ITPage({
  breadcrumbs,
  description,
  icon,
  title,
  ...props
}: Props) {
  const { t } = useTranslation("common");
  const crumbs: ITBreadcrumbItem[] = breadcrumbs ?? [
    { label: t("breadcrumbs.home"), href: "#/home" },
    ...(title ? [{ label: title }] : []),
  ];
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
