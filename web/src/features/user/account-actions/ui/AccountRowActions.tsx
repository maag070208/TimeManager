import { ITDropdownMenu, type ITDropdownMenuItem } from "@axzydev/axzy_ui_system";
import { LuEllipsis, LuKeyRound, LuTrash2, LuUndo2, LuUserCog, LuUserX } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { AccountActions, AccountTarget } from "../model/useAccountActions";

interface Props {
  fx: AccountActions;
  person: AccountTarget;
  /** Abre la cuenta (usuario, rol, correo); se omite si no hay permiso. */
  onAccount?: (person: AccountTarget) => void;
}

/**
 * Acciones de cuenta de una fila en un solo menú "⋯": la fila se queda con
 * ver y editar, y lo demás no satura la tabla.
 */
export default function AccountRowActions({ fx, person, onAccount }: Props) {
  const { t } = useTranslation("users");
  const items: ITDropdownMenuItem[] = [];
  if (onAccount) items.push({ id: "account", label: t("list.accountBtn"), icon: <LuUserCog size={14} />, onClick: () => onAccount(person) });
  if (fx.can.edit) items.push({ id: "password", label: t("list.passwordHeading"), icon: <LuKeyRound size={14} />, onClick: () => fx.openPassword(person) });
  const status: ITDropdownMenuItem[] = [];
  if (person.active) {
    if (fx.can.deactivate) status.push({ id: "deactivate", label: t("list.confirmDeactivateBtn"), icon: <LuUserX size={14} />, danger: true, onClick: () => fx.setToDeactivate(person) });
  } else {
    if (fx.can.deactivate) status.push({ id: "reactivate", label: t("list.reactivateBtn"), icon: <LuUndo2 size={14} />, onClick: () => fx.setToReactivate(person) });
    if (fx.can.delete) status.push({ id: "delete", label: t("list.confirmDeleteBtn"), icon: <LuTrash2 size={14} />, danger: true, onClick: () => fx.setToDelete(person) });
  }
  if (items.length && status.length) items.push({ id: "divider", label: "", divider: true });
  items.push(...status);
  if (!items.length) return null;

  return (
    // El menú vive en la fila: el clic no debe abrir también la persona.
    <span onClick={(e) => e.stopPropagation()}>
      <ITDropdownMenu
        placement="bottom-end"
        triggerLabel={t("list.moreActions", { name: person.name })}
        trigger={
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300">
            <LuEllipsis aria-hidden size={16} />
          </span>
        }
        items={items}
      />
    </span>
  );
}
