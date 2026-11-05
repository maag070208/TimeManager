import type { ReactNode } from "react";
import { ITCard, ITText, ITFlex } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuCheck } from "react-icons/lu";

interface Props {
  /** Número de la sección (1, 2, 3…). */
  number: number;
  title: string;
  description?: string;
  /** Ícono de línea, tenue, junto al título. */
  icon?: ReactNode;
  /** Sección completa: la insignia muestra una palomita en vez del número. */
  complete?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Sección numerada de un formulario de página completa (plantilla P4): `ITCard`
 * sin estilos forzados, así que fondo, borde y radio los decide la apariencia
 * del proveedor. La insignia es un chip pastel que pasa a verde al completarse.
 */
export default function FormSection({ number, title, description, icon, complete = false, className = "", children }: Props) {
  const { t } = useTranslation("common");
  return (
    <ITCard className={className}>
      <div className={`flex items-start gap-3 ${children ? "mb-4" : ""}`}>
        <ITText as="span"
          aria-label={complete ? t("formSection.complete") : undefined}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold tabular-nums transition-colors"
          style={
            complete
              ? { background: "var(--color-success-soft)", color: "color-mix(in srgb, var(--color-success) 80%, #000)" }
              : { background: "var(--color-primary-soft)", color: "var(--color-primary)" }
          }
        >
          {complete ? <LuCheck size={16} strokeWidth={3} /> : number}
        </ITText>
        {/* Título arriba y descripción debajo: en fila se pegaban. */}
        <ITFlex direction="column" gap={0} className="min-w-0 flex-1">
          <ITFlex align="center" gap={2} className="min-w-0">
            {icon && <ITText as="span" className="flex shrink-0 items-center text-slate-400">{icon}</ITText>}
            <ITText as="h3" className="m-0 truncate !text-[16px] font-bold !text-slate-800">{title}</ITText>
          </ITFlex>
          {description && <ITText className="m-0 mt-1 text-[12px] text-slate-500">{description}</ITText>}
        </ITFlex>
      </div>
      {children}
    </ITCard>
  );
}
