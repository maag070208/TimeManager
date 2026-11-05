import type { ReactNode } from "react";
import { ITButton } from "@axzydev/axzy_ui_system";

export type RowActionTone = "primary" | "secondary" | "success" | "warning" | "danger" | "error" | "gray";

interface Props {
  /** Ícono de línea; el botón no lleva texto. */
  icon: ReactNode;
  /** Nombre accesible y tooltip (obligatorio: no hay texto visible). */
  label: string;
  onClick: () => void;
  /** Color del relleno. Por significado: editar = primary, borrar = error, ver = secondary. */
  tone?: RowActionTone;
  disabled?: boolean;
}

/**
 * Acción de una fila de tabla: botón **solo ícono**, relleno del color que le
 * toca y forma de píldora (el `ITButton` del kit ya lo redondea en bento). Es la
 * única forma aceptada de poner acciones en una tabla: sin texto y sin borde
 * suelto, para que todas las tablas se vean igual.
 */
export default function RowAction({ icon, label, onClick, tone = "primary", disabled = false }: Props) {
  return (
    <ITButton
      variant="filled"
      color={tone === "danger" ? "error" : tone}
      size="lg"
      title={label}
      ariaLabel={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </ITButton>
  );
}
