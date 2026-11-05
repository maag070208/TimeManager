import { ITChip, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { roleLabel, type User } from "@entities/user";
import { ProfileAvatar } from "@shared/ui/profile-avatar";

interface Props {
  user: User;
}

/**
 * Identidad de la cuenta dentro del mosaico héroe del historial: avatar, nombre,
 * usuario y los datos que la pantalla ya tiene (rol, estado, departamento y
 * número de empleado). Todo con componentes del sistema: `ITFlex`, `ITText`,
 * `ITChip` y `ProfileAvatar`; sin etiquetas sueltas ni estilos en línea.
 */
export default function UserHeaderCard({ user }: Props) {
  const { t } = useTranslation("users");

  return (
    <ITFlex direction="column" gap={2} className="mt-1 min-h-0 flex-1 justify-center">
      <ITFlex align="center" gap={3} className="min-w-0">
        <ProfileAvatar name={user.name} photoUrl={user.photoUrl} size="lg" />
        <ITFlex direction="column" gap={0} className="min-w-0">
          <ITText className="truncate font-bold !text-[15px] !leading-tight">{user.name}</ITText>
          <ITText muted className="truncate !text-[12px]">
            @{user.username}
          </ITText>
        </ITFlex>
      </ITFlex>

      <ITFlex wrap="wrap" gap={1.5}>
        <ITChip size="sm" color={user.active ? "success" : "danger"}>
          {roleLabel(user.role)}
        </ITChip>
        <ITChip size="sm" color={user.active ? "success" : "danger"}>
          {user.active ? t("table.statusActive") : t("table.statusInactive")}
        </ITChip>
        {user.department?.name && (
          <ITChip size="sm" color="gray">
            {user.department.name}
          </ITChip>
        )}
        {user.employeeNumber && (
          <ITChip size="sm" color="gray">
            #{user.employeeNumber}
          </ITChip>
        )}
      </ITFlex>

      {user.jobTitle && (
        <ITText muted className="truncate !text-[11.5px]">
          {user.jobTitle}
        </ITText>
      )}
    </ITFlex>
  );
}
