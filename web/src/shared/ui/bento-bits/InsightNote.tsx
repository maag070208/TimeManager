import type { ReactNode } from "react";
import { ITText } from "@axzydev/axzy_ui_system";

interface Props {
  children: ReactNode;
  /** Ícono de línea opcional a la izquierda del texto. */
  icon?: ReactNode;
  className?: string;
}

/** Frase de lectura al pie de una tarjeta: caja redondeada tenue con el texto en gris. */
export default function InsightNote({ children, icon, className = "" }: Props) {
  return (
    <ITText
      className={`m-0 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,currentColor_5%,transparent)] px-3 py-2 text-[12px] ${className}`}
      style={{ color: "var(--it-bento-muted)" }}
    >
      {icon && <ITText as="span" className="mt-px flex shrink-0 items-center">{icon}</ITText>}
      <ITText as="span" className="min-w-0">{children}</ITText>
    </ITText>
  );
}
