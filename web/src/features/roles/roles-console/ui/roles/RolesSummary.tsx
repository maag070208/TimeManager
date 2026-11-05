import { ITBentoStatStrip, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import type { RoleAdmin } from "@entities/permission";
import { roleLabel } from "@entities/user";
import { ROLE_TONES, ROLE_VARS, roleTone } from "../shared/tokens";

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
 * Resumen del control de acceso con la **misma tira del kit que Tickets**: las
 * cuatro cifras en mosaicos con tono, la barra apilada de personas por rol
 * debajo y la leyenda al pie. Nada de una tarjeta aparte.
 */
export default function RolesSummary({ rolesMeta, catalogTotal, people, policiesCount }: Props) {
  const { t } = useTranslation("roles");

  const assignments = rolesMeta.reduce((acc, role) => acc + role.userCount, 0);
  const withPeople = rolesMeta
    .filter((role) => role.userCount > 0)
    .sort((a, b) => b.userCount - a.userCount);

  return (
    <div className="flex flex-col gap-2">
      <ITBentoStatStrip
        stack
        items={[
          {
            id: "roles",
            label: t("summary.roles"),
            value: rolesMeta.length,
            caption: t("summary.rolesHint"),
            tone: "sea",
            color: ROLE_VARS.slate,
          },
          {
            id: "permissions",
            label: t("summary.permissions"),
            value: catalogTotal,
            caption: t("summary.permissionsHint"),
            tone: "lavender",
            color: ROLE_VARS.indigo,
          },
          {
            id: "people",
            label: t("summary.people"),
            value: people,
            caption: t("summary.peopleHint"),
            tone: "mint",
            color: ROLE_VARS.emerald,
          },
          {
            id: "policies",
            label: t("summary.policies"),
            value: policiesCount,
            caption: t("summary.policiesHint"),
            tone: "sun",
            color: ROLE_VARS.amber,
          },
        ]}
        stackItems={withPeople.map((role) => ({
          id: role.key,
          label: roleLabel(role.key),
          value: role.userCount,
          color: ROLE_VARS[roleTone(role.key)],
        }))}
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
