import { ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuGavel, LuKeyRound, LuShieldCheck, LuUsersRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { RoleAdmin } from "@entities/permission";
import { roleLabel } from "@entities/user";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { ROLE_TONES, roleTone } from "../shared/tokens";

interface Props {
  rolesMeta: RoleAdmin[];
  /** Tamaño del catálogo de permisos. */
  catalogTotal: number;
  /** Personas con algún rol (principal o adicional). */
  people: number;
  /** Reglas de política activas. */
  policiesCount: number;
}

/**
 * Resumen del control de acceso: cuatro KPIs blancos con waves y, debajo, la
 * distribución de personas por rol. Las cifras son estáticas (no filtran).
 */
export default function RolesSummary({ rolesMeta, catalogTotal, people, policiesCount }: Props) {
  const { t } = useTranslation("roles");

  const assignments = rolesMeta.reduce((acc, role) => acc + role.userCount, 0);
  const withPeople = rolesMeta
    .filter((role) => role.userCount > 0)
    .sort((a, b) => b.userCount - a.userCount);

  return (
    <div className="flex flex-col gap-2">
      <BentoKpiGrid
        items={[
          {
            id: "roles",
            label: t("summary.roles"),
            value: rolesMeta.length,
            caption: t("summary.rolesHint"),
            icon: <LuShieldCheck size={14} />,
          },
          {
            id: "permissions",
            label: t("summary.permissions"),
            value: catalogTotal,
            caption: t("summary.permissionsHint"),
            icon: <LuKeyRound size={14} />,
          },
          {
            id: "people",
            label: t("summary.people"),
            value: people,
            caption: t("summary.peopleHint"),
            tone: "success",
            icon: <LuUsersRound size={14} />,
          },
          {
            id: "policies",
            label: t("summary.policies"),
            value: policiesCount,
            caption: t("summary.policiesHint"),
            tone: "warning",
            icon: <LuGavel size={14} />,
          },
        ]}
      />

      {/* Leyenda de la barra: quién ocupa cada color */}
      <ITFlex wrap="wrap" align="center" gap={3} className="px-1">
        {withPeople.slice(0, 9).map((role) => (
          <ITFlex key={role.key} align="center" gap={1.5}>
            <ITText as="span" className={`h-2 w-2 rounded-full ${ROLE_TONES[roleTone(role.key)].dot}`} />
            <ITText className="!text-[11.5px] font-semibold">{roleLabel(role.key)}</ITText>
            <ITText muted className="!text-[11.5px] tabular-nums">{role.userCount}</ITText>
          </ITFlex>
        ))}
        <ITText muted className="ml-auto !text-[11.5px]">
          {t("summary.assignments", { assignments, people })}
        </ITText>
      </ITFlex>
    </div>
  );
}
