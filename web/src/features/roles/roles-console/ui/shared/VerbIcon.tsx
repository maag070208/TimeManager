import type { ReactNode } from "react";
import { FaBolt, FaEye, FaPen, FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { permissionVerb, type PermissionVerb } from "../../model/access-levels";
import { ITText } from "@axzydev/axzy_ui_system";

const STYLE: Record<PermissionVerb, string> = {
  view: "bg-sky-50 text-sky-600",
  create: "bg-emerald-50 text-emerald-600",
  edit: "bg-amber-50 text-amber-600",
  delete: "bg-rose-50 text-rose-600",
  other: "bg-violet-50 text-violet-600",
};

const ICON: Record<PermissionVerb, ReactNode> = {
  view: <FaEye size={9} />,
  create: <FaPlus size={8} />,
  edit: <FaPen size={8} />,
  delete: <FaTrash size={8} />,
  other: <FaBolt size={8} />,
};

/** Ícono del verbo del permiso (Ver · Crear · Editar · Eliminar · Acción). */
export default function VerbIcon({ permissionKey }: { permissionKey: string }) {
  const { t } = useTranslation("roles");
  const verb = permissionVerb(permissionKey);
  return (
    <ITText as="span"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${STYLE[verb]}`}
      title={t(`verb.${verb}`)}
    >
      {ICON[verb]}
    </ITText>
  );
}
